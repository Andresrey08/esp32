const fs = require('fs');
const path = require('path');

// Leer archivo TSV
const datos = fs.readFileSync(path.join(__dirname, 'Untitled-2.tsv'), 'utf-8');
const lineas = datos.trim().split('\n');

// Parsear datos
const angulos = [];
const pid = [];
const corriente = [];

lineas.forEach(linea => {
  // Primero intentar con corriente
  let match = linea.match(/AngX:\s*([-\d.]+)\s+PID:\s*([-\d.]+)\s+Corriente:\s*([-\d.]+)/);
  if (match) {
    angulos.push(parseFloat(match[1]));
    pid.push(parseFloat(match[2]));
    corriente.push(parseFloat(match[3]));
  } else {
    // Si no tiene corriente, intentar formato antiguo
    match = linea.match(/AngX:\s*([-\d.]+)\s+PID:\s*([-\d.]+)/);
    if (match) {
      angulos.push(parseFloat(match[1]));
      pid.push(parseFloat(match[2]));
      corriente.push(0);
    }
  }
});

// Función de filtro de media móvil
function mediaMovil(datos, ventana = 10) {
  const resultado = [];
  for (let i = 0; i < datos.length; i++) {
    let suma = 0;
    let count = 0;
    const inicio = Math.max(0, i - Math.floor(ventana / 2));
    const fin = Math.min(datos.length, i + Math.ceil(ventana / 2));
    
    for (let j = inicio; j < fin; j++) {
      suma += datos[j];
      count++;
    }
    resultado.push(suma / count);
  }
  return resultado;
}

// Aplicar filtro de media móvil a la corriente
const corrienteFiltrada = mediaMovil(corriente, 10);

// Generar HTML con gráfico usando Chart.js
const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Datos PID - ESP32</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      text-align: center;
    }
    canvas {
      max-height: 400px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    .stat-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #007bff;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Análisis de Datos PID - ESP32</h1>
    
    <div style="margin-bottom: 30px;">
      <canvas id="chartAngulo"></canvas>
    </div>
    
    <div style="margin-bottom: 30px;">
      <canvas id="chartPID"></canvas>
    </div>
    
    <div style="margin-bottom: 30px;">
      <canvas id="chartCombinado"></canvas>
    </div>
    
    <div style="margin-bottom: 30px;">
      <canvas id="chartCorriente"></canvas>
    </div>
    
    <div style="margin-bottom: 30px;">
      <canvas id="chartAnguloCorriente"></canvas>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Muestras</div>
        <div class="stat-value">${angulos.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ángulo Promedio</div>
        <div class="stat-value">${(angulos.reduce((a, b) => a + b, 0) / angulos.length).toFixed(2)}°</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">PID Promedio</div>
        <div class="stat-value">${(pid.reduce((a, b) => a + b, 0) / pid.length).toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ángulo Mín/Máx</div>
        <div class="stat-value">${Math.min(...angulos).toFixed(2)}° / ${Math.max(...angulos).toFixed(2)}°</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">PID Mín/Máx</div>
        <div class="stat-value">${Math.min(...pid).toFixed(2)} / ${Math.max(...pid).toFixed(2)}</div>
      </div>
      ${corriente.some(c => c !== 0) ? `
      <div class="stat-card">
        <div class="stat-label">Corriente Promedio</div>
        <div class="stat-value">${(corriente.reduce((a, b) => a + b, 0) / corriente.length).toFixed(2)} A</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Corriente Mín/Máx</div>
        <div class="stat-value">${Math.min(...corriente).toFixed(2)} / ${Math.max(...corriente).toFixed(2)} A</div>
      </div>` : ''}
    </div>
  </div>

  <script>
    const indices = Array.from({length: ${angulos.length}}, (_, i) => i);
    const angulos = ${JSON.stringify(angulos)};
    const pid = ${JSON.stringify(pid)};
    const corriente = ${JSON.stringify(corriente)};
    const corrienteFiltrada = ${JSON.stringify(corrienteFiltrada)};

    // Gráfico de Ángulo
    new Chart(document.getElementById('chartAngulo'), {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Ángulo X (°)',
          data: angulos,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          tension: 0.1,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Ángulo X en el Tiempo'
          },
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Ángulo (°)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Muestra'
            }
          }
        },
        plugins: {
          zoom: {
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true
              },
              mode: 'x',
            },
            pan: {
              enabled: true,
              mode: 'x',
            }
          }
        }
      }
    });

    // Gráfico de PID
    new Chart(document.getElementById('chartPID'), {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Salida PID',
          data: pid,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          tension: 0.1,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Salida PID en el Tiempo'
          },
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Salida PID'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Muestra'
            }
          }
        },
        plugins: {
          zoom: {
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true
              },
              mode: 'x',
            },
            pan: {
              enabled: true,
              mode: 'x',
            }
          }
        }
      }
    });

    // Gráfico Combinado
    new Chart(document.getElementById('chartCombinado'), {
      type: 'line',
      data: {
        labels: indices,
        datasets: [
          {
            label: 'Ángulo X (°)',
            data: angulos,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            yAxisID: 'y',
            tension: 0.1,
            pointRadius: 0
          },
          {
            label: 'Salida PID',
            data: pid,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y1',
            tension: 0.1,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          title: {
            display: true,
            text: 'Ángulo vs Salida PID'
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Ángulo (°)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Salida PID'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        },
        plugins: {
          zoom: {
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true
              },
              mode: 'x',
            },
            pan: {
              enabled: true,
              mode: 'x',
            }
          }
        }
      }
    });

    // Gráfico de Corriente
    if (corriente.some(c => c !== 0)) {
      new Chart(document.getElementById('chartCorriente'), {
        type: 'line',
        data: {
          labels: indices,
          datasets: [
            {
              label: 'Corriente Original (A)',
              data: corriente,
              borderColor: 'rgba(255, 159, 64, 0.3)',
              backgroundColor: 'rgba(255, 159, 64, 0.05)',
              tension: 0.1,
              pointRadius: 0,
              borderWidth: 1
            },
            {
              label: 'Corriente Filtrada (Media Móvil)',
              data: corrienteFiltrada,
              borderColor: 'rgb(255, 99, 71)',
              backgroundColor: 'rgba(255, 99, 71, 0.1)',
              tension: 0.1,
              pointRadius: 0,
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Corriente ACS712 en el Tiempo'
            },
            legend: {
              display: true
            }
          },
          scales: {
            y: {
              title: {
                display: true,
                text: 'Corriente (A)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Muestra'
              }
            }
          },
          plugins: {
            zoom: {
              zoom: {
                wheel: {
                  enabled: true,
                },
                pinch: {
                  enabled: true
                },
                mode: 'x',
              },
              pan: {
                enabled: true,
                mode: 'x',
              }
            }
          }
        }
      });

      // Gráfico combinado: Ángulo X y Corriente
      new Chart(document.getElementById('chartAnguloCorriente'), {
        type: 'line',
        data: {
          labels: indices,
          datasets: [
            {
              label: 'Ángulo X (°)',
              data: angulos,
              borderColor: 'rgb(75, 192, 192)',
              backgroundColor: 'rgba(75, 192, 192, 0.1)',
              yAxisID: 'y',
              tension: 0.1,
              pointRadius: 0
            },
            {
              label: 'Corriente Filtrada (A)',
              data: corrienteFiltrada,
              borderColor: 'rgb(255, 99, 71)',
              backgroundColor: 'rgba(255, 99, 71, 0.1)',
              yAxisID: 'y1',
              tension: 0.1,
              pointRadius: 0,
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            title: {
              display: true,
              text: 'Ángulo X vs Corriente'
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Ángulo (°)'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Corriente (A)'
              },
              grid: {
                drawOnChartArea: false
              }
            }
          },
          plugins: {
            zoom: {
              zoom: {
                wheel: {
                  enabled: true,
                },
                pinch: {
                  enabled: true
                },
                mode: 'x',
              },
              pan: {
                enabled: true,
                mode: 'x',
              }
            }
          }
        }
      });
    }
  </script>
</body>
</html>`;

// Guardar HTML
fs.writeFileSync(path.join(__dirname, 'grafico.html'), html);
console.log('✅ Gráfico generado: grafico.html');
console.log(`📊 Total de muestras: ${angulos.length}`);
console.log(`📐 Rango de ángulos: ${Math.min(...angulos).toFixed(2)}° a ${Math.max(...angulos).toFixed(2)}°`);
console.log(`🎛️  Rango PID: ${Math.min(...pid).toFixed(2)} a ${Math.max(...pid).toFixed(2)}`);
if (corriente.some(c => c !== 0)) {
  console.log(`⚡ Rango de corriente: ${Math.min(...corriente).toFixed(2)} a ${Math.max(...corriente).toFixed(2)} A`);
}
