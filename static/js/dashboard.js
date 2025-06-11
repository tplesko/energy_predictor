document.addEventListener('DOMContentLoaded', () => {
  const householdForm = document.getElementById('addHouseholdForm');
  const householdList = document.getElementById('householdList');
  const householdSelect = document.getElementById('householdSelect');
  const historyTable = document.getElementById('historyTable').querySelector('tbody');

  // Kućanstva
  fetch('/get_households')
  .then(res => res.json())
  .then(data => {
    householdList.innerHTML = '';
    householdSelect.innerHTML = '';

    // Dodaj "Sva kućanstva"
    const allLi = document.createElement('li');
    allLi.textContent = 'Sva kućanstva';
    allLi.classList.add('household-item');
    householdList.appendChild(allLi);

    const allOption = document.createElement('option');
    allOption.value = 'ALL';
    allOption.textContent = 'Sva kućanstva';
    householdSelect.appendChild(allOption);

    data.forEach(name => {
      const li = document.createElement('li');
      li.textContent = name;
      li.classList.add('household-item');
      li.tabIndex = 0;
      householdList.appendChild(li);

      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      householdSelect.appendChild(option);
    });

    // ✅ Premjesti ovdje nakon što su dodani
    householdSelect.value = 'ALL';
    const firstLi = householdList.querySelector('li');
    if (firstLi) firstLi.classList.add('active');
  });

  fetch('/get_predictions')
    .then(res => res.json())
    .then(data => {
      const today = new Date();
      const todayFiltered = data.filter(d => {
        const date = new Date(d.timestamp);
        return date.toDateString() === today.toDateString();
      });
      const sortOrder = document.getElementById('sortOrder').value;
      updateHistoryTable(todayFiltered, sortOrder);
      renderChartsPerHousehold(todayFiltered);
    });

  householdForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('householdName').value;
    fetch('/add_household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).then(() => location.reload());
  });

  document.getElementById('predictionForm').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    fetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(() => location.reload());
  });

  document.getElementById('applyFilters').addEventListener('click', () => {
    const selected = document.getElementById('householdSelect').value;
    const day = document.getElementById('filterDay').value;
    const month = document.getElementById('filterMonth').value;
    const year = document.getElementById('filterYear').value;
  
    if (!year) {
      alert('Molimo odaberite godinu kako bi se primijenili filteri.');
      return;
    }
  
    fetch('/get_predictions')
      .then(res => res.json())
      .then(data => {
        let filtered = data.filter(d => {
          const date = new Date(d.timestamp);
          return (!day || date.getDate() == day) &&
                 (!month || (date.getMonth() + 1) == month) &&
                 date.getFullYear() == year;
        });
  
        if (selected !== 'ALL') {
          filtered = filtered.filter(d => d.household === selected);
        }
  
        if (filtered.length === 0) {
          alert('Nema rezultata za odabrane filtere.');
          return;
        }
  
        const sortOrder = document.getElementById('sortOrder')?.value || 'desc';
        updateHistoryTable(filtered, sortOrder);
  
        // Prikaži odgovarajuće grafove
        if (selected === 'ALL') {
          renderChartsPerHousehold(filtered);
        } else {
          renderChartsPerHousehold(filtered);
          renderFeatureAveragesForHousehold(filtered);
        }
      });
  });  

  document.getElementById('resetFilters').addEventListener('click', () => {
    // Reset vrijednosti inputa
    document.getElementById('filterDay').value = '';
    document.getElementById('filterMonth').value = '';
    document.getElementById('filterYear').value = '';
  
    // Vrati na "Sva kućanstva danas"
    document.getElementById('householdSelect').value = 'ALL';
  
    fetch('/get_predictions')
      .then(res => res.json())
      .then(data => {
        const today = new Date();
        const todayFiltered = data.filter(d => {
          const date = new Date(d.timestamp);
          return date.toDateString() === today.toDateString();
        });
        updateHistoryTable(todayFiltered);
        renderChartsPerHousehold(todayFiltered);
      });
  });
  

  document.getElementById('householdList').addEventListener('click', e => {
    if (e.target.tagName === 'LI') {
      const selected = e.target.textContent;
      document.getElementById('householdSelect').value = selected === 'Sva kućanstva' ? 'ALL' : selected;
      fetch('/get_predictions')
        .then(res => res.json())
        .then(data => {
          if (selected === 'Sva kućanstva') {
            const today = new Date();
            const filtered = data.filter(d => {
              const date = new Date(d.timestamp);
              return date.toDateString() === today.toDateString();
            });
            const sortOrder = document.getElementById('sortOrder').value;
            updateHistoryTable(filtered, sortOrder);
            renderChartsPerHousehold(filtered);
          } else {
            const filtered = data.filter(d => d.household === selected);
            const sortOrder = document.getElementById('sortOrder').value;
            updateHistoryTable(filtered, sortOrder);
            renderChartsPerHousehold(filtered);
            renderFeatureAveragesForHousehold(filtered);
          }
        });
    }
  });

  const infoIcon = document.getElementById('infoIcon');
  const tooltip = document.getElementById('globalTooltip');
  if (infoIcon && tooltip) {
    infoIcon.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
    });
    infoIcon.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }
});

function updateHistoryTable(data, sortOrder = 'desc') {
  const historyTable = document.getElementById('historyTable').querySelector('tbody');
  historyTable.innerHTML = '';

  if (data.length === 0) {
    const row = historyTable.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.style.textAlign = 'center';
    cell.textContent = 'Nema dostupnih predikcija.';
    return;
  }

  const sorted = data.slice().sort((a, b) => {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  sorted.forEach(entry => {
    const row = historyTable.insertRow();
    row.innerHTML = `
      <td>${entry.household}</td>
      <td>${entry.timestamp}</td>
      <td>${entry.prediction}</td>
    `;
  });
}

document.getElementById('sortOrder').addEventListener('change', () => {
  const selected = document.getElementById('householdSelect').value;
  const sortOrder = document.getElementById('sortOrder').value;

  fetch('/get_predictions')
    .then(res => res.json())
    .then(data => {
      let filtered;
      if (selected === 'ALL') {
        const today = new Date();
        filtered = data.filter(d => {
          const date = new Date(d.timestamp);
          return date.toDateString() === today.toDateString();
        });
      } else {
        filtered = data.filter(d => d.household === selected);
      }
      updateHistoryTable(filtered, sortOrder);
    });
});


  document.addEventListener('DOMContentLoaded', () => {
    const infoIcon = document.getElementById('infoIcon');
    const tooltip = document.getElementById('globalTooltip');
  
    if (infoIcon) {
      const tooltipText = `
        <strong>Global_reactive_power</strong>: Ukupna reaktivna snaga (kW).<br>
        <strong>Voltage</strong>: Napon isporučen kućanstvu (V).<br>
        <strong>Global_intensity</strong>: Prosječna struja (A).<br>
        <strong>Sub_metering_1</strong>: Potrošnja kuhinje (kW).<br>
        <strong>Sub_metering_2</strong>: Potrošnja praonice (kW).<br>
        <strong>Sub_metering_3</strong>: Potrošnja bojlera i klime (kW).
      `;
  
      infoIcon.addEventListener('mouseenter', e => {
        tooltip.innerHTML = tooltipText;
        tooltip.style.display = 'block';
  
        const rect = infoIcon.getBoundingClientRect();
        tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
        tooltip.style.left = `${rect.left + window.scrollX}px`;
      });
  
      infoIcon.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    }
  });

  function renderChartsPerHousehold(data) {
    const ctx1 = document.getElementById('predictionTrendChart');
    const ctx2 = document.getElementById('householdComparisonChart');
    if (window.trendChart) window.trendChart.destroy();
    if (window.featureChart) window.featureChart.destroy();
  
    const colors = ['#FF4B2B', '#1f77b4', '#2ca02c', '#d62728', '#9467bd'];
    const households = [...new Set(data.map(d => d.household))];
  
    // 1. Detektiraj vremenski raspon
    const timestamps = data.map(d => new Date(d.timestamp));
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));
    const timeDiff = maxDate - minDate;
    const oneDay = 1000 * 60 * 60 * 24;
  
    let timeUnit = 'hour';
    if (timeDiff < oneDay) timeUnit = 'hour';
    else if (timeDiff < oneDay * 32) timeUnit = 'day';
    else if (timeDiff < oneDay * 366) timeUnit = 'month';
    else timeUnit = 'year';
  
    // 2. Grupiraj podatke po vremenskoj jedinici
    function groupByUnit(data, unit) {
      const grouped = {};
  
      data.forEach(d => {
        const date = new Date(d.timestamp);
        let key;
  
        if (unit === 'hour') {
          key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:00`;
        } else if (unit === 'day') {
          key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        } else if (unit === 'month') {
          key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        } else if (unit === 'year') {
          key = `${date.getFullYear()}`;
        }
  
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(d.prediction);
      });
  
      return Object.entries(grouped).map(([key, values]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return { x: new Date(key), y: avg };
      });
    }
  
    const datasets = households.map((house, idx) => {
      const entries = data.filter(d => d.household === house);
      const groupedData = groupByUnit(entries, timeUnit);
  
      return {
        label: house,
        data: groupedData,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '55',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 4
      };
    });
  
    // 3. Trend chart
    window.trendChart = new Chart(ctx1, {
      type: 'line',
      data: { datasets },
      options: {
        plugins: { legend: { display: true } },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: timeUnit,
              tooltipFormat: 'dd.MM.yyyy HH:mm',
              displayFormats: {
                hour: 'HH:mm',
                day: 'dd.MM.',
                month: 'MM.yyyy',
                year: 'yyyy'
              }
            },
            title: { display: true, text: 'Vrijeme' }
          },
          y: {
            title: { display: true, text: 'Predikcija (kWh)' }
          }
        }
      }
    });
  
    // 4. Bar chart: ukupna suma
    const sums = households.map(h =>
      data
        .filter(d => d.household === h)
        .reduce((acc, val) => acc + val.prediction, 0)
        .toFixed(2)
    );
  
    window.featureChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: households,
        datasets: [{
          label: 'Ukupna potrošnja',
          data: sums,
          minBarLength: 4,
          backgroundColor: households.map((_, idx) => colors[idx % colors.length])
        }]
      },
      options: {
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function (context) {
                return `Kućanstvo: ${context.label}, Potrošnja: ${context.raw} kWh`;
              }
            }
          }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'kWh' }
          }
        }
      }
    });
  }    
  function renderFeatureAveragesForHousehold(data) {
    const ctx = document.getElementById('householdComparisonChart');
    if (window.featureChart) window.featureChart.destroy();
  
    const features = [
      { key: 'Voltage', label: 'Voltage', unit: 'V' },
      { key: 'Global_reactive_power', label: 'Reactive Power', unit: 'kW' },
      { key: 'Global_intensity', label: 'Intensity', unit: 'A' },
      { key: 'Sub_metering_1', label: 'Kitchen', unit: 'Wh' },
      { key: 'Sub_metering_2', label: 'Laundry', unit: 'Wh' },
      { key: 'Sub_metering_3', label: 'Water Heater / AC', unit: 'Wh' }
    ];
  
    const labels = [];
    const values = [];
    const units = [];
  
    features.forEach(f => {
      const vals = data.map(d => parseFloat(d[f.key])).filter(v => !isNaN(v));
      const avg = vals.length ? vals.reduce((acc, v) => acc + v, 0) / vals.length : 0;
      labels.push(f.label);
      values.push(avg.toFixed(2));
      units.push(f.unit);
    });
  
    window.featureChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Prosječna vrijednost',
          data: values,
          backgroundColor: '#FF4B2B'
        }]
      },
      options: {
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed.y ?? context.raw;
                const unitMap = {
                  'Voltage': 'V',
                  'Reactive Power': 'kW',
                  'Intensity': 'A',
                  'Kitchen': 'Wh',
                  'Laundry': 'Wh',
                  'Water Heater / AC': 'Wh'
                };
                const unit = unitMap[label] || '';
                return `${label}: ${value} ${unit}`;
              }
            }
          }
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Vrijednost' }
          }
        }
      }
    });
  }

  function getTimeUnitBasedOnFilter() {
    const day = document.getElementById('filterDay').value;
    const month = document.getElementById('filterMonth').value;
    const year = document.getElementById('filterYear').value;
  
    if (day && month && year) return 'hour';     // npr. 2.2.2025 → prikaži po satu
    if (month && year) return 'day';             // npr. veljača 2025 → prikaži po danu
    if (year) return 'month';                    // cijela godina → prikaži po mjesecu
    return 'minute';                             // fallback
  }
  
  