document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const toggle = document.querySelector("[data-nav-toggle]");
  const close = document.querySelector("[data-nav-close]");
  const filters = Array.from(document.querySelectorAll("[data-nav-filter]"));
  const navLinks = Array.from(document.querySelectorAll(".docs-sidebar nav a"));
  const groups = Array.from(document.querySelectorAll("[data-nav-group]"));
  const pageItems = Array.from(document.querySelectorAll("[data-nav-page]"));

  const setPageSections = (toggle, expanded) => {
    const sections = document.getElementById(toggle.getAttribute("aria-controls"));
    toggle.setAttribute("aria-expanded", String(expanded));
    if (sections) sections.hidden = !expanded;
  };

  document.querySelectorAll("[data-nav-page-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      setPageSections(toggle, toggle.getAttribute("aria-expanded") !== "true");
    });
  });

  const setNavigation = (open) => {
    body.classList.toggle("nav-open", open);
    toggle?.setAttribute("aria-expanded", String(open));
  };

  toggle?.addEventListener("click", () => setNavigation(!body.classList.contains("nav-open")));
  close?.addEventListener("click", () => setNavigation(false));
  navLinks.forEach((link) => link.addEventListener("click", () => setNavigation(false)));

  const filterNavigation = (value, source) => {
    const query = value.trim().toLowerCase();
    filters.forEach((input) => {
      if (input !== source) input.value = value;
    });

    navLinks.forEach((link) => {
      const match = !query || link.textContent.toLowerCase().includes(query);
      const item = link.closest("li");
      if (item) item.hidden = !match;
      if (link.classList.contains("overview-link")) link.hidden = !match;
    });

    pageItems.forEach((item) => {
      const pageLink = item.querySelector(":scope > .nav-page-row > a");
      const toggle = item.querySelector(":scope > .nav-page-row > [data-nav-page-toggle]");
      const sectionItems = Array.from(item.querySelectorAll(".nav-page-sections li"));
      const pageMatch = !query || pageLink?.textContent.toLowerCase().includes(query);
      const visibleSections = sectionItems.some((section) => !section.hidden);
      item.hidden = Boolean(query) && !pageMatch && !visibleSections;

      if (!toggle) return;
      if (query) {
        if (!toggle.dataset.beforeFilterExpanded) {
          toggle.dataset.beforeFilterExpanded = toggle.getAttribute("aria-expanded");
        }
        setPageSections(toggle, visibleSections);
      } else if (toggle.dataset.beforeFilterExpanded) {
        setPageSections(toggle, toggle.dataset.beforeFilterExpanded === "true");
        delete toggle.dataset.beforeFilterExpanded;
      }
    });

    groups.forEach((group) => {
      const title = group.querySelector(".nav-group-title");
      const titleMatch = title?.textContent.toLowerCase().includes(query);
      const visibleChildren = Array.from(group.querySelectorAll("li")).some((item) => !item.hidden);
      group.hidden = Boolean(query) && !titleMatch && !visibleChildren;
      if (title) title.hidden = false;
    });
  };

  filters.forEach((input) => input.addEventListener("input", (event) => filterNavigation(event.target.value, event.target)));

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
      event.preventDefault();
      const input = window.innerWidth < 820 ? filters[1] : filters[0];
      input?.focus();
    }
    if (event.key === "Escape") {
      setNavigation(false);
      filters.forEach((input) => { input.value = ""; });
      filterNavigation("", null);
    }
  });

  document.querySelectorAll(".prose pre").forEach((pre) => {
    const code = pre.querySelector("code");
    if (!code) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button";
    button.textContent = "Copy";
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = "Copy"; }, 1400);
    });
    pre.append(button);
  });
});