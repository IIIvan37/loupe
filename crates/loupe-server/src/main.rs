//! `loupe` — the distributable entry point, route 2 (parity with
//! `server/app/cli.py`): pick the port, refuse a busy one with an actionable
//! message, open the browser once `/health` answers, serve until Ctrl-C.

use loupe_server::config::{Config, DEFAULT_PORT};
use loupe_server::download::YtDlpEngine;
use std::net::SocketAddr;
use std::process::ExitCode;
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, PartialEq)]
struct Args {
  port: u16,
  no_browser: bool,
}

/// What the invocation asks for: serve, or print something and exit.
#[derive(Debug, PartialEq)]
enum Command {
  Run(Args),
  Help,
  Version,
}

const USAGE: &str = "usage: loupe [--port <numéro>] [--no-browser] [--version]\n\n\
Démarre l'atelier loupe et ouvre le navigateur.\n\n\
options:\n  \
--port <numéro>   port d'écoute local (défaut : 6173)\n  \
--no-browser      ne pas ouvrir le navigateur au démarrage\n  \
--version         afficher la version et quitter";

fn parse_args(argv: &[String]) -> Result<Command, String> {
  let mut args = Args {
    port: DEFAULT_PORT,
    no_browser: false,
  };
  let mut iter = argv.iter();
  while let Some(arg) = iter.next() {
    match arg.as_str() {
      "-h" | "--help" => return Ok(Command::Help),
      "-V" | "--version" => return Ok(Command::Version),
      "--no-browser" => args.no_browser = true,
      "--port" => {
        let value = iter.next().ok_or("--port attend un numéro")?;
        args.port = value
          .parse()
          .map_err(|_| format!("port invalide : {value}"))?;
      }
      other => match other.strip_prefix("--port=") {
        Some(value) => {
          args.port = value
            .parse()
            .map_err(|_| format!("port invalide : {value}"))?;
        }
        None => return Err(format!("argument inconnu : {other}")),
      },
    }
  }
  Ok(Command::Run(args))
}

/// Tell the user when a newer release exists (D5) — one line, best-effort,
/// on its own thread so it never delays serving. Opt-out:
/// LOUPE_NO_VERSION_CHECK=1.
fn spawn_version_check() {
  if std::env::var_os("LOUPE_NO_VERSION_CHECK").is_some() {
    return;
  }
  std::thread::spawn(|| {
    use loupe_server::version_check::{latest_release_tag, newer_version, RELEASES_REPO};
    let newer = latest_release_tag(RELEASES_REPO)
      .and_then(|tag| newer_version(env!("CARGO_PKG_VERSION"), &tag));
    if let Some(version) = newer {
      println!(
        "loupe : version {version} disponible — https://github.com/{RELEASES_REPO}/releases/latest"
      );
    }
  });
}

/// Open `url` as soon as `/health` answers; give up quietly past the deadline
/// (the user still has the printed URL). Runs on its own thread so it never
/// delays serving.
fn spawn_browser_opener(url: String) {
  std::thread::spawn(move || {
    let deadline = std::time::Instant::now() + Duration::from_secs(15);
    loop {
      let healthy = ureq::get(format!("{url}/health"))
        .call()
        .is_ok_and(|response| response.status() == 200);
      if healthy {
        let _ = webbrowser::open(&url);
        return;
      }
      if std::time::Instant::now() >= deadline {
        return;
      }
      std::thread::sleep(Duration::from_millis(200));
    }
  });
}

#[tokio::main]
async fn main() -> ExitCode {
  let argv: Vec<String> = std::env::args().skip(1).collect();
  let args = match parse_args(&argv) {
    Ok(Command::Run(args)) => args,
    Ok(Command::Help) => {
      println!("{USAGE}");
      return ExitCode::SUCCESS;
    }
    Ok(Command::Version) => {
      // The release workflow pins this to the git tag (tag → crate →
      // --version, one version everywhere).
      println!("loupe {}", env!("CARGO_PKG_VERSION"));
      return ExitCode::SUCCESS;
    }
    Err(message) => {
      eprintln!("loupe : {message}");
      eprintln!("{USAGE}");
      return ExitCode::from(2);
    }
  };

  let config = Config::from_env();
  spawn_version_check();
  // Boot backstop for temp dirs a hard kill left behind (D2 parity) — the
  // engine also sweeps before each download.
  loupe_download::sweep_stale_downloads(&config.data_dir.join("downloads"));
  // Reclaim orphaned audio blobs while nothing is in flight (lifespan-hook
  // parity) — the browser client relies on this and never calls /gc.
  loupe_server::boot_gc(&config);

  // Bind first instead of probing: no TOCTOU, and `--port 0` naturally picks
  // a free port that the printed URL reflects.
  let listener = match tokio::net::TcpListener::bind(("127.0.0.1", args.port)).await {
    Ok(listener) => listener,
    Err(_) => {
      eprintln!(
        "loupe : le port {} est déjà occupé — relancer avec --port <numéro>.",
        args.port
      );
      return ExitCode::FAILURE;
    }
  };
  let port = listener
    .local_addr()
    .map(|addr| addr.port())
    .unwrap_or(args.port);
  // 127.0.0.1, not `localhost`: the listener binds IPv4 only, and on Windows
  // `localhost` often resolves to IPv6 `::1` first — a fresh navigation there
  // (e.g. an auth redirect) hits nothing and is refused. The literal keeps the
  // opened URL, the bind, and every later same-origin request on one address.
  let url = format!("http://127.0.0.1:{port}");
  println!("loupe : atelier sur {url} (Ctrl-C pour quitter)");
  if !args.no_browser {
    spawn_browser_opener(url);
  }

  let app = loupe_server::build_app(config, Arc::new(YtDlpEngine));
  let serve = axum::serve(
    listener,
    app.into_make_service_with_connect_info::<SocketAddr>(),
  )
  .with_graceful_shutdown(async {
    let _ = tokio::signal::ctrl_c().await;
  });
  match serve.await {
    Ok(()) => ExitCode::SUCCESS,
    Err(error) => {
      eprintln!("loupe : erreur serveur : {error}");
      ExitCode::FAILURE
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn argv(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| (*s).to_owned()).collect()
  }

  fn run_args(argv_items: &[&str]) -> Args {
    match parse_args(&argv(argv_items)).unwrap() {
      Command::Run(args) => args,
      other => panic!("expected Run, got {other:?}"),
    }
  }

  #[test]
  fn defaults_to_port_6173_with_the_browser_on() {
    assert_eq!(
      run_args(&[]),
      Args {
        port: 6173,
        no_browser: false
      }
    );
  }

  #[test]
  fn accepts_both_port_forms_and_no_browser() {
    assert_eq!(
      run_args(&["--port", "7000", "--no-browser"]),
      Args {
        port: 7000,
        no_browser: true
      }
    );
    assert_eq!(run_args(&["--port=7001"]).port, 7001);
  }

  #[test]
  fn refuses_garbage_and_reports_help_and_version() {
    assert!(parse_args(&argv(&["--port"])).is_err());
    assert!(parse_args(&argv(&["--port", "beaucoup"])).is_err());
    assert!(parse_args(&argv(&["--vite"])).is_err());
    assert_eq!(parse_args(&argv(&["--help"])).unwrap(), Command::Help);
    assert_eq!(parse_args(&argv(&["--version"])).unwrap(), Command::Version);
    assert_eq!(parse_args(&argv(&["-V"])).unwrap(), Command::Version);
  }
}
