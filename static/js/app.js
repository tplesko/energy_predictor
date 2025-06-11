const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

signUpButton.addEventListener('click', () => {
	container.classList.add("right-panel-active");
});

signInButton.addEventListener('click', () => {
	container.classList.remove("right-panel-active");
});

function addPredictListener(formId) {
	document.getElementById(formId).addEventListener("submit", async function (e) {
	  e.preventDefault();
  
	  const now = new Date();
	  const hour = now.getHours();
	  const day = now.getDate();
	  const month = now.getMonth() + 1;
	  const year = now.getFullYear();
	  const weekday = now.getDay();
	  const is_weekend = (weekday === 0 || weekday === 6) ? 1 : 0;
  
	  const form = e.target;
	  const features = [
		parseFloat(form.querySelector('[name="Global_reactive_power"]').value),
		parseFloat(form.querySelector('[name="Voltage"]').value),
		parseFloat(form.querySelector('[name="Global_intensity"]').value),
		parseFloat(form.querySelector('[name="Sub_metering_1"]').value),
		parseFloat(form.querySelector('[name="Sub_metering_2"]').value),
		parseFloat(form.querySelector('[name="Sub_metering_3"]').value),
		hour, day, month, year, weekday, is_weekend
	  ];
  
	  const response = await fetch("https://energy-api-obaz.onrender.com/predict", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ data: [features] })
	  });
  
	  const result = await response.json();
	  if (response.ok) {
		alert("⚡ Predikcija: " + result.prediction[0].toFixed(3));
	  } else {
		alert("❌ Greška: " + result.error);
	  }
	});
  }
  
  addPredictListener("predictFormLeft");
  addPredictListener("predictFormRight");
  