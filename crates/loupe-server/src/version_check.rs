//! Startup version notification (D5): compare the running binary's version
//! with the latest published GitHub release and tell the user — nothing
//! more. No self-update: in beta, re-downloading one file is the update.
//! Best-effort by design: any network or parse failure stays silent.

/// Where releases live; also the URL printed to the user.
pub const RELEASES_REPO: &str = "IIIvan37/loupe";

/// The latest release's tag (e.g. "v0.2.0"), from the public GitHub API.
/// Best-effort: any failure is None. The GitHub API rejects requests with no
/// User-Agent (403), so we send an explicit, identifying one.
pub fn latest_release_tag(repo: &str) -> Option<String> {
  let mut response = ureq::get(format!(
    "https://api.github.com/repos/{repo}/releases/latest"
  ))
  .header("User-Agent", concat!("loupe/", env!("CARGO_PKG_VERSION")))
  .header("Accept", "application/vnd.github+json")
  .call()
  .ok()?;
  let body = response.body_mut().read_to_string().ok()?;
  let value: serde_json::Value = serde_json::from_str(&body).ok()?;
  Some(value.get("tag_name")?.as_str()?.to_owned())
}

/// The newer version the tag announces, or None if the tag is not strictly
/// newer than `current`. Tags are `vX.Y.Z` (the release workflow enforces
/// it); anything else — pre-releases, garbage, short tags — is ignored
/// rather than nagging the user on a bad parse.
pub fn newer_version(current: &str, latest_tag: &str) -> Option<String> {
  let latest = latest_tag.strip_prefix('v').unwrap_or(latest_tag);
  (parse(latest)? > parse(current)?).then(|| latest.to_owned())
}

fn parse(version: &str) -> Option<(u64, u64, u64)> {
  let mut parts = version.split('.');
  let triple = (
    parts.next()?.parse().ok()?,
    parts.next()?.parse().ok()?,
    parts.next()?.parse().ok()?,
  );
  parts.next().is_none().then_some(triple)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn announces_a_strictly_newer_release() {
    assert_eq!(newer_version("0.1.0", "v0.2.0"), Some("0.2.0".to_owned()));
    assert_eq!(newer_version("0.9.9", "v1.0.0"), Some("1.0.0".to_owned()));
    assert_eq!(newer_version("0.1.0", "0.1.1"), Some("0.1.1".to_owned()));
  }

  #[test]
  fn stays_silent_on_same_or_older_releases() {
    assert_eq!(newer_version("0.2.0", "v0.2.0"), None);
    assert_eq!(newer_version("0.2.0", "v0.1.9"), None);
  }

  #[test]
  fn compares_numerically_not_lexicographically() {
    assert_eq!(newer_version("0.9.0", "v0.10.0"), Some("0.10.0".to_owned()));
    assert_eq!(newer_version("0.10.0", "v0.9.0"), None);
  }

  #[test]
  fn ignores_tags_that_are_not_bare_semver_triples() {
    assert_eq!(newer_version("0.1.0", "beta"), None);
    assert_eq!(newer_version("0.1.0", "v1.2"), None);
    assert_eq!(newer_version("0.1.0", "v1.2.3.4"), None);
    assert_eq!(newer_version("0.1.0", "v1.2.3-rc.1"), None);
    assert_eq!(newer_version("not-a-version", "v1.2.3"), None);
  }
}
