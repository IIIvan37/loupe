//! `rust-embed` refuses to compile against a missing folder, but the web dist
//! only exists after `scripts/build-loupe-binary.sh` copied it here — plain
//! `cargo test`/`clippy` (dev, CI) must work without it, so make sure the
//! folder at least exists.

fn main() {
  let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("cargo sets CARGO_MANIFEST_DIR");
  let web_dist = std::path::Path::new(&manifest_dir).join("web_dist");
  std::fs::create_dir_all(&web_dist).expect("cannot create web_dist/");
  // The embed macro can't emit cargo directives itself: re-run (and re-embed)
  // whenever the copied dist changes.
  println!("cargo:rerun-if-changed=web_dist");
}
