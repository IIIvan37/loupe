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

const USAGE: &str = "usage: loupe [--port <numéro>] [--no-browser]\n\n\
Démarre l'atelier loupe et ouvre le navigateur.\n\n\
options:\n  \
--port <numéro>   port d'écoute local (défaut : 6173)\n  \
--no-browser      ne pas ouvrir le navigateur au démarrage";

fn parse_args(argv: &[String]) -> Result<Option<Args>, String> {
  let mut args = Args {
    port: DEFAULT_PORT,
    no_browser: false,
  };
  let mut iter = argv.iter();
  while let Some(arg) = iter.next() {
    match arg.as_str() {
      "-h" | "--help" => return Ok(None),
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
  Ok(Some(args))
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
    Ok(Some(args)) => args,
    Ok(None) => {
      println!("{USAGE}");
      return ExitCode::SUCCESS;
    }
    Err(message) => {
      eprintln!("loupe : {message}");
      eprintln!("{USAGE}");
      return ExitCode::from(2);
    }
  };

  let config = Config::from_env();
  // Boot backstop for temp dirs a hard kill left behind (D2 parity) — the
  // engine also sweeps before each download.
  loupe_download::sweep_stale_downloads(&config.data_dir.join("downloads"));

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
  let url = format!("http://localhost:{port}");
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

  #[test]
  fn defaults_to_port_6173_with_the_browser_on() {
    let args = parse_args(&[]).unwrap().unwrap();
    assert_eq!(
      args,
      Args {
        port: 6173,
        no_browser: false
      }
    );
  }

  #[test]
  fn accepts_both_port_forms_and_no_browser() {
    let args = parse_args(&argv(&["--port", "7000", "--no-browser"]))
      .unwrap()
      .unwrap();
    assert_eq!(
      args,
      Args {
        port: 7000,
        no_browser: true
      }
    );
    let args = parse_args(&argv(&["--port=7001"])).unwrap().unwrap();
    assert_eq!(args.port, 7001);
  }

  #[test]
  fn refuses_garbage_and_reports_help() {
    assert!(parse_args(&argv(&["--port"])).is_err());
    assert!(parse_args(&argv(&["--port", "beaucoup"])).is_err());
    assert!(parse_args(&argv(&["--vite"])).is_err());
    assert!(parse_args(&argv(&["--help"])).unwrap().is_none());
  }
}
