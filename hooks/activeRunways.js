function toRad(degrees) {
    const pi = Math.PI;

    return degrees * (pi / 180);
}

export function getRunwaysWeather(weatherData, airportData) {
    if (!airportData) { return null; }
    if (!weatherData) { return null; }

    const windDirection = weatherData.wind.degrees;
    const windSpeed = weatherData.wind.speed_kts;

    const result = {};

    for (const runway of airportData.runways) {
        const he_heading = runway.he_heading_degT - 180;

        const le_heading = runway.he_heading_degT;

        const he_headtailwind = Math.round(windSpeed * Math.cos(toRad(windDirection - he_heading)) * 100)/100;

        const he_crosswind = Math.round(windSpeed * Math.sin(toRad(windDirection - he_heading)) * 100)/100;

        const he_crosswind_side = he_crosswind > 0 ? "left" : "right";

        // const he_status = he_headtailwind > 0 ? "tailwind" : Math.abs(he_crosswind) > Math.abs(he_headtailwind) ? "crosswind" : "headwind";

        const he_status = {
            "headtailwind": he_headtailwind,
            "crosswind": Math.abs(he_crosswind),
            "mainWind": he_headtailwind > 0 ? "tailwind" : Math.abs(he_crosswind) > Math.abs(he_headtailwind) ? "crosswind" : "headwind"
        }
        
        const le_headtailwind = Math.round(windSpeed * Math.cos(toRad(windDirection - le_heading)));

        const le_crosswind = Math.round(windSpeed * Math.sin(toRad(windDirection - le_heading)) * 100)/100;

        const le_crosswind_side = le_crosswind < 0 ? "right" : "left";

        // const le_status = le_headtailwind > 0 ? "tailwind" : Math.abs(le_crosswind) > Math.abs(le_headtailwind) ? "crosswind" : "headwind";

        const le_status = {
            "headtailwind": he_headtailwind,
            "crosswind": Math.abs(he_crosswind),
            "mainWind": le_headtailwind > 0 ? "tailwind" : Math.abs(le_crosswind) > Math.abs(le_headtailwind) ? "crosswind" : "headwind"
        }

        result[runway.le_ident] = {
            status: le_status,
            crosswind: Math.abs(le_crosswind),
            crosswindSide: le_crosswind_side,
            headtailwind: le_headtailwind,
            headtailwindType: le_headtailwind > 0 ? "tailwind" : "headwind",
        };

        result[runway.he_ident] = {
            status: he_status,
            crosswind: Math.abs(he_crosswind),
            crosswindSide: he_crosswind_side,
            headtailwind: he_headtailwind,
            headtailwindType: he_headtailwind > 0 ? "tailwind" : "headwind",
        };
    }

    return result;
}

export default getRunwaysWeather;