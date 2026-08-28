try {
  document.documentElement.dataset.theme = localStorage.getItem("quiet-checklist-theme") || "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}
