function page(title, description, canonicalPath, active, body) {  const links = [["/privacy", "Privacy policy", "privacy"], ["/terms", "Terms of service", "terms"], ["/account-deletion", "Account deletion", "account-deletion"], ["/support", "Support", "support"]];
  const nav = links.map(([href, label, key]) => `<a href="${href}"${key === active ? ' style="color:var(--text)"' : ""}>${label}</a>`).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="theme-color" content="#0B0F14" />
  <link rel="canonical" href="https://freed-landing.web.app${canonicalPath}" />
  <link rel="icon" type="image/svg+xml" href="/assets/freed-symbol.svg" />
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <nav class="nav">
    <div class="wrap nav-inner">
      <a class="brand" href="/"><img class="brand-mark" src="/assets/freed-symbol.svg" width="30" height="30" alt="" aria-hidden="true" /> FREED</a>
      <div class="nav-links">${nav}<a class="nav-cta" href="/">Get FREED</a></div>
    </div>
  </nav>
  <main class="page"><div class="wrap legal-shell">${body}</div></main>
  <footer>
    <div class="wrap">
      <div class="foot-grid">
        <div class="col">
          <a class="brand" href="/"><img class="brand-mark" src="/assets/freed-symbol.svg" width="30" height="30" alt="" aria-hidden="true" /> FREED</a>
          <p style="color:var(--text3);font-size:13.5px;margin-top:12px;max-width:260px;">Recovery and digital self-control, private by design.</p>
        </div>
        <div class="col">
          <h4>Legal</h4>
          <a href="/privacy">Privacy policy</a>
          <a href="/terms">Terms of service</a>
          <a href="/account-deletion">Account deletion</a>
        </div>
        <div class="col">
          <h4>Support</h4>
          <a href="/support">Help desk</a>
          <a href="mailto:soumyadebnath1661@gmail.com">soumyadebnath1661@gmail.com</a>
        </div>
      </div>
      <p class="foot-note">© 2026 FREED. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
}
module.exports = { page };
