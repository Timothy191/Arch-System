use std::env;
use std::process;

fn main() {
    // 1. Collect and parse CLI arguments
    let args: Vec<String> = env::args().collect();

    let mut hours: f64 = 150.0;
    let mut temp: f64 = 55.0;
    let mut rpm: f64 = 1000.0;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--hours" => {
                if i + 1 < args.len() {
                    hours = args[i + 1].parse::<f64>().unwrap_or_else(|_| {
                        eprintln!("{{\"error\":\"Invalid value for --hours\"}}");
                        process::exit(1);
                    });
                    i += 1;
                }
            },
            "--temp" => {
                if i + 1 < args.len() {
                    temp = args[i + 1].parse::<f64>().unwrap_or_else(|_| {
                        eprintln!("{{\"error\":\"Invalid value for --temp\"}}");
                        process::exit(1);
                    });
                    i += 1;
                }
            },
            "--rpm" => {
                if i + 1 < args.len() {
                    rpm = args[i + 1].parse::<f64>().unwrap_or_else(|_| {
                        eprintln!("{{\"error\":\"Invalid value for --rpm\"}}");
                        process::exit(1);
                    });
                    i += 1;
                }
            },
            _ => {} // Ignore unknown arguments
        }
        i += 1;
    }

    // Boundary Validation
    if hours < 0.0 || temp < -50.0 || temp > 500.0 || rpm < 0.0 {
         eprintln!("{{\"error\":\"Parameters out of realistic physical bounds\"}}");
         process::exit(1);
    }

    // 2. Perform stress-fatigue multi-variable mathematical regression
    // Standard Base Fatigue Index (Hours factor)
    let base_fatigue = hours * 0.18;

    // Thermal stress index (starts ramping aggressively above 65°C)
    let thermal_stress = if temp > 65.0 {
        (temp - 65.0) * 2.4
    } else {
        0.0
    };

    // Kinetic stress index (RPM factor relative to 1200 normal index)
    let kinetic_stress = (rpm / 1200.0) * 7.5;

    // Aggregate Cumulative Wear Index
    let wear_index = base_fatigue + thermal_stress + kinetic_stress;

    // 3. Sigmoid Logistic regression to failure probability percentage
    // P(t) = 1 / (1 + e^(- (wear - shift) / scale))
    let z = (wear_index - 45.0) / 10.0;

    // Prevent overflow/NaN in extreme edge cases
    let exp_term = (-z).exp();
    let prob_pct = if exp_term.is_infinite() {
        0.0
    } else {
        (1.0 / (1.0 + exp_term)) * 100.0
    };

    // 4. Project Remaining Useful Life (RUL) in hours
    let max_life = 1200.0;
    let wear_rate = 1.0 + (wear_index * 0.05);
    let mut rul_hours = ((max_life - hours) / wear_rate).max(0.0);
    if rul_hours.is_nan() || rul_hours.is_infinite() {
        rul_hours = 0.0;
    }

    // 5. Determine health classification status
    let status = if prob_pct > 75.0 {
        "critical"
    } else if prob_pct > 35.0 {
        "warning"
    } else {
        "optimal"
    };

    // 6. Print pure JSON string directly to stdout for Node FFI to consume
    println!(
        "{{\"wearIndex\":{:.2},\"probability\":{:.1},\"rulHours\":{:.1},\"status\":\"{}\"}}",
        wear_index, prob_pct, rul_hours, status
    );
}
