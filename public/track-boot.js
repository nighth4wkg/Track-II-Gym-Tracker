try {
  document.documentElement.dataset.theme = localStorage.getItem("quiet-checklist-theme") || "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}

window.setTimeout(() => {
  document.querySelector(".track-loading")?.classList.add("track-loading-stalled");
}, 8000);
