(function () {
  "use strict";

  var backButton = document.getElementById("freed-back");
  var toggleBreath = document.getElementById("freed-toggle-breath");
  var breather = document.getElementById("freed-breather");
  var breathStart = document.getElementById("freed-breath-start");
  var circle = document.getElementById("freed-breath-circle");
  var label = document.getElementById("freed-breath-label");

  backButton.addEventListener("click", function () {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.replace("about:newtab");
    }
  });

  toggleBreath.addEventListener("click", function () {
    breather.hidden = !breather.hidden;
    toggleBreath.textContent = breather.hidden ? "Take a breath instead" : "Hide breathing";
  });

  var PHASES = [
    { name: "Breathe in", seconds: 4 },
    { name: "Hold", seconds: 7 },
    { name: "Breathe out", seconds: 8 }
  ];
  var timer = null;

  breathStart.addEventListener("click", function () {
    if (timer) return;
    circle.classList.add("running");
    var phaseIndex = 0;
    var remaining = PHASES[0].seconds;
    label.textContent = PHASES[0].name + " · " + remaining;

    timer = setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        phaseIndex = (phaseIndex + 1) % PHASES.length;
        remaining = PHASES[phaseIndex].seconds;
      }
      label.textContent = PHASES[phaseIndex].name + " · " + remaining;
    }, 1000);
  });

  fetch(chrome.runtime.getURL("rules/metadata.json"))
    .then(function (response) { return response.json(); })
    .then(function (metadata) {
      if (metadata && typeof metadata.domainCount === "number") {
        document.getElementById("freed-meta").textContent =
          " · " + metadata.domainCount.toLocaleString() + " reviewed domains";
      }
    })
    .catch(function () {});
})();
