const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const prayersDiv = document.getElementById("prayers");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const dateText = document.getElementById("date");

const today = new Date().toISOString().split("T")[0];
dateText.textContent = new Date().toDateString();

let data = JSON.parse(localStorage.getItem(today)) || {};

prayers.forEach(prayer => {
  const div = document.createElement("div");
  div.className = "prayer";

  const span = document.createElement("span");
  span.textContent = prayer;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = data[prayer] || false;

  checkbox.addEventListener("change", () => {
    data[prayer] = checkbox.checked;
    localStorage.setItem(today, JSON.stringify(data));
    updateProgress();
  });

  div.appendChild(span);
  div.appendChild(checkbox);
  prayersDiv.appendChild(div);
});

function updateProgress() {
  const completed = Object.values(data).filter(Boolean).length;
  const percent = (completed / prayers.length) * 100;
  progressBar.style.width = percent + "%";
  progressText.textContent = `${completed} / 5 prayers completed`;
}

updateProgress();
