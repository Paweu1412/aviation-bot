import { Client } from 'eris';
import fetch from 'node-fetch-commonjs';

import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client(process.env.DISCORD_BOT_TOKEN);

import { getRunwaysWeather } from './hooks/activeRunways.js';

import { readFile } from 'fs/promises';

const translates = JSON.parse(await readFile('./languages.json'));
import mysql from 'mysql';

const airportDbToken = process.env.AIRPORT_DB_TOKEN;
const checkWxApiToken = process.env.CHECK_WX_API_TOKEN;

// setTimeout(async () => {
//     await client.getCommands()
//         .then((commands) => {
//             console.log(commands);
//         })
// }, 5000)

let databasePool;

function dbQuery(query, vars, callback) {
    databasePool.query(query, vars, (error, results, fields) => callback(error, results, fields));
}

client.on('ready', async () => {
    try {
        await client.editStatus('online', { name: 'discord.gg/JB2ubrPDzA' });

        await client.createCommand({
            name: 'info',
            type: 1,
            description: 'Check airport information',
            options: [{
                name: 'icao',
                type: 3,
                description: 'Airport ICAO code (e.g. EPKK)',
                required: true
            }]
        });

        databasePool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true
        });

        databasePool.query('SELECT 1 + 1 AS solution', (error) => {
            if (error) {
                console.log(`Connection failed: ${error.message}`);
                process.exit(0);
            } else {
                console.log('Connection success, bot is ready!');
            }
        });
    } catch (err) {
        console.error(err);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction) { return null; }

        if (interaction.data.name === 'info') {
            const icaoCode = interaction.data.options[0].value.toUpperCase();
            let weatherData;

            await fetch(`https://api.checkwx.com/metar/${icaoCode}/decoded?x-api-key=${checkWxApiToken}`)
                .then(res => res.json())
                .then(res => {
                    weatherData = res.data[0];
                });

            await fetch(`https://airportdb.io/api/v1/airport/${icaoCode}?apiToken=${airportDbToken}`)
                .then(res => res.json())
                .then(async airportData => {
                    await sendAirportInformation(interaction, weatherData, airportData);
                });
        }
    } catch (err) {
        console.error(err);
    }
});

async function sendAirportInformation(interaction, weatherData, airportData) {
    let interactionMemberUsername = `${interaction.member.user.username}#${interaction.member.user.discriminator}`;
    let interactionMemberGuildName = interaction.member.guild.name;
    let interactionMemberGuildID = interaction.member.guild.id;

    let chosenLanguage = 'english';

    dbQuery('SELECT `language` FROM `languages` WHERE `id`=?', [interactionMemberGuildID], async (error, results, fields) => {
        if (results.length) {
            results = JSON.parse(JSON.stringify(results));
            chosenLanguage = results[0].language;

            if (!airportData.name || !weatherData) {
                return interaction.createMessage({
                    "embed": {
                        "color": 16777215,
                        "description": `${translates[chosenLanguage].not_in_database}`
                    }
                });
            }

            const runwaysInfo = getRunwaysWeather(weatherData, airportData);
            if (!runwaysInfo) { return null; }

            const date = new Date();

            let currentDate = ("0" + date.getDate()).slice(-2) + "/" + ("0" + (date.getMonth() + 1)).slice(-2) + "/" + date.getFullYear() + " " + ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2);

            const informationEmbedTemplate = {
                "embed": {
                    "title": airportData.name,
                    "thumbnail": {
                        "url": "https://media.discordapp.net/attachments/1045000837241524264/1045001174383857676/airport.png"
                    },

                    "description": `***${translates[chosenLanguage].airport_info}***`,
                    "color": 16777215,

                    "fields": [
                        {
                            "name": `${translates[chosenLanguage].iata}`,
                            "value": airportData.iata_code ? airportData.iata_code : 'n/a',
                        },
                        {

                            "name": `${translates[chosenLanguage].elevation}`,
                            "value": airportData.elevation_ft ? `${airportData.elevation_ft}ft / ${Math.round(airportData.elevation_ft * 0.304)}m` : 'n/a',
                        },
                        {
                            "name": `${translates[chosenLanguage].runways}`,
                            "value": airportData.runways ? ((airportData.runways).length * 2) : 'n/a',
                        },
                        {
                            "name": `${translates[chosenLanguage].wiki}`,
                            "value": airportData.wikipedia_link ? airportData.wikipedia_link : 'n/a',
                        },
                    ]
                }
            };

            function getCloudsInformation() {
                if (!weatherData) { return null; }

                if (!weatherData.clouds) { return '' }

                let callbackInformation = '';

                for (let i = 0; i < weatherData.clouds.length; i++) {
                    let returnString = '';

                    if (weatherData.clouds[i]) {
                        if (weatherData.clouds[i].code && weatherData.clouds[i].feet) {
                            returnString = `${weatherData.clouds[i].code} / ${weatherData.clouds[i].feet}ft`;
                        }

                        if (weatherData.clouds[i].code && (!weatherData.clouds[i].feet)) {
                            returnString = `${weatherData.clouds[i].code} / -`;
                        }

                        if ((!weatherData.clouds[i].code) && weatherData.clouds[i].feet) {
                            returnString = `- / ${weatherData.clouds[i].feet}`;
                        }
                    }

                    callbackInformation += `${returnString}\n`
                }

                return callbackInformation !== '' ? callbackInformation : 'n/a';
            }

            const weatherEmbedTemplate = {
                "embed": {
                    "description": `***${translates[chosenLanguage].weather_info}***`,
                    "thumbnail": {
                        "url": "https://media.discordapp.net/attachments/1045000837241524264/1045001175008821319/cloudy-day.png"
                    },

                    "color": 16777215,

                    "fields": [
                        {
                            "name": `${translates[chosenLanguage].raw}`,
                            "value": weatherData.raw_text ? weatherData.raw_text : 'n/a',
                        },
                        {
                            "name": `${translates[chosenLanguage].pressure}`,
                            "value": weatherData.barometer ? `${weatherData.barometer.hpa}hPa / ${weatherData.barometer.hg}hgIn` : 'n/a',
                            "inline": true,
                        },
                        {
                            "name": `${translates[chosenLanguage].humidity}`,
                            "value": weatherData.humidity ? `${weatherData.humidity.percent}%` : 'n/a',
                            "inline": true,
                        },
                        {
                            "name": `${translates[chosenLanguage].temperature}`,
                            "value": weatherData.temperature ? `${weatherData.temperature.celsius}°C` : 'n/a',
                            "inline": true
                        },
                        {

                            "name": `${translates[chosenLanguage].dew_point}`,
                            "value": weatherData.dewpoint ? `${weatherData.dewpoint.celsius}°C` : 'n/a',
                            "inline": true,
                        },
                        {
                            "name": `${translates[chosenLanguage].visibility}`,
                            "value": weatherData.visibility ? `${weatherData.visibility.meters} m` : 'n/a',
                            "inline": true
                        },
                        {
                            "name": `${translates[chosenLanguage].wind}`,
                            "value": weatherData.wind ? `${weatherData.wind.degrees}° / ${weatherData.wind.speed_kts}kts` : 'n/a',
                            "inline": true
                        },
                        {
                            "name": `${translates[chosenLanguage].wind_chill}`,
                            "value": weatherData.windchill ? `${weatherData.windchill.celsius}°C` : 'n/a',
                            "inline": true

                        },
                        {
                            "name": `${translates[chosenLanguage].flight_cat}`,
                            "value": weatherData.flight_category ? weatherData.flight_category : 'n/a',
                            "inline": true
                        },
                        {
                            "name": `${translates[chosenLanguage].clouds}`,
                            "value": getCloudsInformation(),
                            "inline": true
                        },
                        {
                            "name": `${translates[chosenLanguage].observed}`,
                            "value": weatherData.observed,
                            "inline": true
                        },
                    ]
                }
            };

            const runwaysEmbedTemplate = {
                "embed": {
                    "description": `***${translates[chosenLanguage].rwy_info}***`,
                    "thumbnail": {
                        "url": "https://media.discordapp.net/attachments/1045000837241524264/1045001174685843526/runway.png"
                    },

                    "color": 16777215,

                    "fields": [],

                    "footer": {
                        "text": `🟩 ${translates[chosenLanguage].safe}\n🟩 ⚠️ ${translates[chosenLanguage].relatively_safe}\n🟥 ${translates[chosenLanguage].unsafe}\n\n${translates[chosenLanguage].generated_at} ${currentDate}\n\n${translates[chosenLanguage].footer_information}`
                    }
                }
            };

            for (const runway of airportData.runways) {
                function getRunwayAvailabilityStatus(runway) {
                    if (runwaysInfo[runway].status.mainWind === 'headwind') {
                        return '🟩';
                    }

                    if (runwaysInfo[runway].status.mainWind === 'crosswind') {
                        if (runwaysInfo[runway].crosswind <= 10) {
                            return '🟩';
                        }

                        return '🟩 ⚠️';
                    }

                    if (runwaysInfo[runway].status.mainWind === 'tailwind') {
                        if (runwaysInfo[runway].headtailwind <= 5) {
                            return '🟩 ⚠️';
                        }

                        return '🟥';
                    }

                    return null;
                }

                function getRunwayWindInformation(runway) {
                    let crosswindSide = runwaysInfo[runway].crosswindSide;

                    console.log(runwaysInfo[runway].headtailwind);

                    let results = {
                        "headwind": Math.round(runwaysInfo[runway].headtailwind) < 0 ? `${Math.round(Math.abs(runwaysInfo[runway].headtailwind))}kts` : undefined,
                        "tailwind": Math.round(runwaysInfo[runway].headtailwind) > 0 ? `${Math.round(Math.abs(runwaysInfo[runway].headtailwind))}kts` : undefined,
                        "crosswind": Math.round(runwaysInfo[runway].crosswind) > 0 ? `${Math.round(Math.abs(runwaysInfo[runway].crosswind))}kts ${translates[chosenLanguage][crosswindSide]}` : undefined
                    };

                    let callback = '';

                    if (results.headwind) {
                        callback += `\n${translates[chosenLanguage].wind} ${translates[chosenLanguage].headwind} ${results.headwind}`
                    }

                    if (results.tailwind) {
                        callback += `\n${translates[chosenLanguage].wind} ${translates[chosenLanguage].tailwind} ${results.tailwind}`
                    }

                    if (results.crosswind) {
                        callback += `\n${translates[chosenLanguage].wind} ${translates[chosenLanguage].crosswind} ${results.crosswind}`
                    }

                    return callback;
                }

                runwaysEmbedTemplate.embed.fields.push(
                    {
                        "name": `${translates[chosenLanguage].rwy} ${runway.le_ident} ${getRunwayAvailabilityStatus(runway.le_ident)}`,
                        "value": `${translates[chosenLanguage].winds}: ${getRunwayWindInformation(runway.le_ident)}\n\n${translates[chosenLanguage].elevation}: ${runway.le_elevation_ft ? `${runway.le_elevation_ft}ft / ${Math.round(runway.le_elevation_ft * 0.304)}m` : 'n/a'}\nILS: ${runway.le_ils !== undefined ? `${runway.le_ils.freq} / ${runway.le_ils.course}°` : 'n/a'}`
                    },
                    {
                        "name": `${translates[chosenLanguage].rwy} ${runway.he_ident} ${getRunwayAvailabilityStatus(runway.he_ident)}`,
                        "value": `${translates[chosenLanguage].winds}: ${getRunwayWindInformation(runway.he_ident)}\n\n${translates[chosenLanguage].elevation}: ${runway.he_elevation_ft ? `${runway.he_elevation_ft}ft / ${Math.round(runway.he_elevation_ft * 0.304)}m` : 'n/a'}\nILS: ${runway.he_ils !== undefined ? `${runway.he_ils.freq} / ${runway.he_ils.course}°` : 'n/a'}`
                    });
            }

            await interaction.createMessage(informationEmbedTemplate);
            await client.createMessage(interaction.channel.id, weatherEmbedTemplate);
            await client.createMessage(interaction.channel.id, runwaysEmbedTemplate);

            await client.createMessage('1044041529557274744', `*${interactionMemberUsername}* z serwera *${interactionMemberGuildName}* właśnie wykonał polecenie /info!`);

            return;
        }
    });
}

client.on('messageCreate', async (message) => {
    if (!message.content.includes('number of servers bot')) { return; }
    if (message.channel.id != 1044041529557274744) { return; }

    let numberOfServers = await client.guilds.size;

    await client.createMessage('1044041529557274744', `Liczba serwerów: ${numberOfServers} [${100 - numberOfServers}]`);
});

client.on('guildCreate', async (guild) => {
    await client.createMessage('1044041529557274744', `Paffsowy bot właśnie dołączył na serwer ${guild.name} / ${guild.memberCount}`);

    databasePool.query('INSERT INTO `languages` (id) VALUES (?)', [guild.id], () => { });
});

client.on('guildDelete', async (guild) => {
    if (guild.name === undefined) { return; }

    await client.createMessage('1044041529557274744', `Paffsowy bot właśnie został usunięty z serwera ${guild.name} / ${guild.memberCount}`);

    databasePool.query('DELETE FROM `languages` WHERE id=?', [guild.id], () => { });
});

client.connect();

