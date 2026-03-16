import { useState, useEffect } from 'react'
import styles from './Weather.module.css'

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY
const DEFAULT_CITY = import.meta.env.VITE_WEATHER_CITY ?? 'Toccoa'
const DEFAULT_CITY_LABEL = 'Toccoa, GA'
const DISPLAY_TIMEZONE = 'America/New_York'

const ICON_MAP = {
  '01': '☀',  // clear sky
  '02': '⛅', // few clouds
  '03': '☁',  // scattered clouds
  '04': '☁',  // broken clouds
  '09': '🌧', // shower rain
  '10': '🌦', // rain
  '11': '⛈', // thunderstorm
  '13': '❄',  // snow
  '50': '🌫', // mist
}

function weatherIcon(iconCode) {
  const prefix = iconCode?.slice(0, 2)
  return ICON_MAP[prefix] ?? '◈'
}

export default function Weather() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        let next = null
        try {
          next = await loadOpenMeteo()
        } catch {}
        if (!next) {
          next = await loadWttr()
        }
        setData(next)
        setError(false)
      } catch {
        setError('fetch-failed')
      } finally {
        setLoading(false)
      }
    }

    load()
    const id = setInterval(load, 10 * 60 * 1000) // refresh every 10 min
    return () => clearInterval(id)
  }, [])

  return (
    <>
    <button type="button" className={styles.widget} onClick={() => data && setExpanded(true)}>
      <div className={styles.label}>WEATHER</div>

      {loading && <div className={styles.status}>SCANNING...</div>}

      {error === 'fetch-failed' && (
        <div className={styles.status}>SIGNAL LOST</div>
      )}

      {data && (
        <>
          <div className={styles.main}>
            <span className={styles.icon}>{weatherIcon(data.icon)}</span>
            <span className={styles.temp}>{data.temp}°</span>
          </div>
          <div className={styles.city}>{data.city}</div>
          <div className={styles.currentTime}>NOW {formatNowEastern()}</div>
          <div className={styles.desc}>{data.description.toUpperCase()}</div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.key}>FEELS</span>
            <span className={styles.val}>{data.feels}°F</span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>H / L</span>
            <span className={styles.val}>{data.high}° / {data.low}°</span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>WIND</span>
            <span className={styles.val}>{data.wind} mph</span>
          </div>
          <div className={styles.row}>
            <span className={styles.key}>HUMIDITY</span>
            <span className={styles.val}>{data.humidity}%</span>
          </div>
          {data.hourly?.length > 0 && (
            <div className={styles.forecastBlock}>
              <div className={styles.blockLabel}>NEXT HOURS</div>
              <div className={styles.hourlyStrip}>
                {data.hourly.slice(0, 4).map(hour => (
                  <div key={hour.time} className={styles.hourChip}>
                    <span className={styles.hourTime}>{hour.label}</span>
                    <span className={styles.hourIcon}>{weatherIcon(hour.icon)}</span>
                    <span className={styles.hourTemp}>{hour.temp}°</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.daily?.length > 0 && (
            <div className={styles.forecastBlock}>
              <div className={styles.blockLabel}>5 DAY</div>
              <div className={styles.dailyList}>
                {data.daily.slice(0, 5).map(day => (
                  <div key={day.day} className={styles.dailyRow}>
                    <span className={styles.dailyDay}>{day.day}</span>
                    <span className={styles.dailyIcon}>{weatherIcon(day.icon)}</span>
                    <span className={styles.dailyTemps}>{day.high}° / {day.low}°</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={styles.expandHint}>TAP FOR FULL FORECAST</div>
        </>
      )}
    </button>

    {expanded && data && (
      <div className={styles.overlay} onClick={() => setExpanded(false)}>
        <div className={styles.panel} onClick={e => e.stopPropagation()}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelEyebrow}>Extended Forecast</div>
              <div className={styles.panelTitle}>{data.city}</div>
              <div className={styles.currentTime}>Current time {formatNowEastern()}</div>
            </div>
            <button type="button" className={styles.closeBtn} onClick={() => setExpanded(false)}>Close</button>
          </div>

          <div className={styles.panelHero}>
            <div className={styles.panelCurrent}>
              <span className={styles.panelIcon}>{weatherIcon(data.icon)}</span>
              <div>
                <div className={styles.panelTemp}>{data.temp}°</div>
                <div className={styles.panelDesc}>{data.description}</div>
              </div>
            </div>
            <div className={styles.panelFacts}>
              <div className={styles.factCard}><span>Feels Like</span><strong>{data.feels}°F</strong></div>
              <div className={styles.factCard}><span>Humidity</span><strong>{data.humidity}%</strong></div>
              <div className={styles.factCard}><span>Wind</span><strong>{data.wind} mph</strong></div>
              <div className={styles.factCard}><span>High / Low</span><strong>{data.high}° / {data.low}°</strong></div>
              <div className={styles.factCard}><span>Sunrise</span><strong>{data.sunrise || '--'}</strong></div>
              <div className={styles.factCard}><span>Sunset</span><strong>{data.sunset || '--'}</strong></div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Hourly Forecast</div>
            <div className={styles.hourlyGrid}>
              {(data.hourly || []).map(hour => (
                <div key={hour.time} className={styles.hourCard}>
                  <div className={styles.hourTime}>{hour.label}</div>
                  <div className={styles.hourIcon}>{weatherIcon(hour.icon)}</div>
                  <div className={styles.hourTemp}>{hour.temp}°</div>
                  <div className={styles.hourMeta}>Feels {hour.feels}°</div>
                  <div className={styles.hourMeta}>Rain {hour.rain}%</div>
                  <div className={styles.hourMeta}>Wind {hour.wind} mph</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Five Day Forecast</div>
            <div className={styles.dailyPanelList}>
              {(data.daily || []).map(day => (
                <div key={day.day} className={styles.dailyPanelRow}>
                  <div className={styles.dailyPanelMain}>
                    <span className={styles.dailyDay}>{day.day}</span>
                    <span className={styles.dailyIcon}>{weatherIcon(day.icon)}</span>
                    <span className={styles.dailySummary}>{day.description}</span>
                  </div>
                  <div className={styles.dailyPanelMeta}>
                    <span>{day.high}° / {day.low}°</span>
                    <span>Rain {day.rain}%</span>
                    <span>UV {day.uv}</span>
                    <span>{day.sunrise} - {day.sunset}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

async function loadOpenWeather() {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(DEFAULT_CITY)}&appid=${API_KEY}&units=imperial`
  )
  const json = await res.json()
  if (json.cod !== 200) throw new Error(json.message)
  return {
    city: json.name,
    temp: Math.round(json.main.temp),
    feels: Math.round(json.main.feels_like),
    high: Math.round(json.main.temp_max),
    low: Math.round(json.main.temp_min),
    humidity: json.main.humidity,
    description: json.weather[0].description,
    icon: json.weather[0].icon,
    wind: Math.round(json.wind.speed),
  }
}

async function loadOpenMeteo() {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(DEFAULT_CITY)}&count=1&language=en&format=json`)
  const geo = await geoRes.json()
  const place = geo.results?.[0]
  if (!place) throw new Error('Location not found')

  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(DISPLAY_TIMEZONE)}&forecast_days=5&forecast_hours=48`
  )
  const json = await weatherRes.json()
  if (!json.current || !json.daily) throw new Error('Weather unavailable')

  return {
    city: DEFAULT_CITY_LABEL,
    temp: Math.round(json.current.temperature_2m),
    feels: Math.round(json.current.apparent_temperature),
    high: Math.round(json.daily.temperature_2m_max?.[0] ?? json.current.temperature_2m),
    low: Math.round(json.daily.temperature_2m_min?.[0] ?? json.current.temperature_2m),
    humidity: Math.round(json.current.relative_humidity_2m),
    description: describeWeatherCode(json.current.weather_code),
    icon: weatherCodeToIcon(json.current.weather_code),
    wind: Math.round(json.current.wind_speed_10m),
    sunrise: formatClock(json.daily.sunrise?.[0]),
    sunset: formatClock(json.daily.sunset?.[0]),
    hourly: buildHourlyForecast(json),
    daily: buildDailyForecast(json),
  }
}

async function loadWttr() {
  const res = await fetch(`https://wttr.in/${encodeURIComponent(DEFAULT_CITY)}?format=j1`)
  const json = await res.json()
  const current = json.current_condition?.[0]
  const today = json.weather?.[0]
  if (!current || !today) throw new Error('Weather unavailable')

  return {
    city: DEFAULT_CITY,
    temp: Math.round(Number(current.temp_F)),
    feels: Math.round(Number(current.FeelsLikeF)),
    high: Math.round(Number(today.maxtempF)),
    low: Math.round(Number(today.mintempF)),
    humidity: Math.round(Number(current.humidity)),
    description: current.weatherDesc?.[0]?.value?.toLowerCase() || 'weather active',
    icon: wttrIcon(current.weatherCode),
    wind: Math.round(Number(current.windspeedMiles)),
    sunrise: today.astronomy?.[0]?.sunrise || '--',
    sunset: today.astronomy?.[0]?.sunset || '--',
    hourly: getWttrHourly(today.hourly || []).map(entry => ({
      time: entry.time,
      label: formatWttrHour(entry.time),
      temp: Math.round(Number(entry.tempF)),
      feels: Math.round(Number(entry.FeelsLikeF || entry.tempF)),
      rain: Math.round(Number(entry.chanceofrain || 0)),
      wind: Math.round(Number(entry.windspeedMiles || 0)),
      icon: wttrIcon(entry.weatherCode),
    })),
    daily: (json.weather || []).slice(0, 5).map(entry => ({
      day: formatDay(entry.date),
      high: Math.round(Number(entry.maxtempF)),
      low: Math.round(Number(entry.mintempF)),
      rain: Math.round(Math.max(...(entry.hourly || []).map(hour => Number(hour.chanceofrain || 0)), 0)),
      uv: entry.uvIndex || '--',
      sunrise: entry.astronomy?.[0]?.sunrise || '--',
      sunset: entry.astronomy?.[0]?.sunset || '--',
      description: entry.hourly?.[4]?.weatherDesc?.[0]?.value?.toLowerCase() || 'weather active',
      icon: wttrIcon(entry.hourly?.[4]?.weatherCode || entry.hourly?.[0]?.weatherCode),
    })),
  }
}

function buildHourlyForecast(json) {
  const times = json.hourly?.time || []
  const nowHourStr = getEasternHourString()
  const startIndex = times.findIndex(time => time >= nowHourStr)
  const begin = startIndex >= 0 ? startIndex : 0
  return times.slice(begin, begin + 12).map((time, index) => ({
    time,
    label: formatClock(time),
    temp: Math.round(json.hourly.temperature_2m?.[begin + index] ?? 0),
    feels: Math.round(json.hourly.apparent_temperature?.[begin + index] ?? 0),
    rain: Math.round(json.hourly.precipitation_probability?.[begin + index] ?? 0),
    wind: Math.round(json.hourly.wind_speed_10m?.[begin + index] ?? 0),
    icon: weatherCodeToIcon(json.hourly.weather_code?.[begin + index]),
  }))
}

function getEasternHourString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = type => parts.find(p => p.type === type)?.value || '00'
  let hour = get('hour')
  if (hour === '24') hour = '00'
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:00`
}

function buildDailyForecast(json) {
  return (json.daily?.time || []).slice(0, 5).map((date, index) => ({
    day: formatDay(date),
    high: Math.round(json.daily.temperature_2m_max?.[index] ?? 0),
    low: Math.round(json.daily.temperature_2m_min?.[index] ?? 0),
    rain: Math.round(json.daily.precipitation_probability_max?.[index] ?? 0),
    uv: Math.round(json.daily.uv_index_max?.[index] ?? 0),
    sunrise: formatClock(json.daily.sunrise?.[index]),
    sunset: formatClock(json.daily.sunset?.[index]),
    description: describeWeatherCode(json.daily.weather_code?.[index]),
    icon: weatherCodeToIcon(json.daily.weather_code?.[index]),
  }))
}

function formatDay(value) {
  return new Date(value).toLocaleDateString('en-US', { weekday: 'short' })
}

function formatClock(value) {
  if (!value) return '--'
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DISPLAY_TIMEZONE,
    timeZoneName: 'short',
  })
}

function formatWttrHour(value = '0') {
  const padded = value.padStart(4, '0')
  const hour = Number(padded.slice(0, 2))
  const date = new Date(getEasternNow())
  date.setHours(hour, 0, 0, 0)
  return formatClock(date)
}

function getWttrHourly(entries) {
  const currentHour = Number(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: DISPLAY_TIMEZONE,
  }).format(new Date()))
  const startIndex = Math.max(0, entries.findIndex(entry => Number(`${entry.time || '0'}`.padStart(4, '0').slice(0, 2)) >= currentHour))
  return entries.slice(startIndex, startIndex + 6)
}

function getEasternNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = type => parts.find(p => p.type === type)?.value || '00'
  let hour = get('hour')
  if (hour === '24') hour = '00'
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`)
}

function formatNowEastern() {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DISPLAY_TIMEZONE,
    timeZoneName: 'short',
  }).format(new Date())
}

function wttrIcon(code) {
  if (code === '113') return '01d'
  if (['116'].includes(code)) return '02d'
  if (['119', '122'].includes(code)) return '03d'
  if (['143', '248', '260'].includes(code)) return '50d'
  if (['176', '263', '266', '281', '293', '296', '299', '302', '305', '308', '311', '314', '353', '356', '359'].includes(code)) return '10d'
  if (['179', '182', '185', '227', '230', '323', '326', '329', '332', '335', '338', '368', '371', '374', '377'].includes(code)) return '13d'
  if (['200', '386', '389', '392', '395'].includes(code)) return '11d'
  return '03d'
}

function weatherCodeToIcon(code) {
  if (code === 0) return '01d'
  if ([1, 2].includes(code)) return '02d'
  if (code === 3) return '03d'
  if ([45, 48].includes(code)) return '50d'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return '10d'
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(code)) return '13d'
  if ([95, 96, 99].includes(code)) return '11d'
  return '03d'
}

function describeWeatherCode(code) {
  const map = {
    0: 'clear sky',
    1: 'mostly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'fog',
    48: 'depositing rime fog',
    51: 'light drizzle',
    53: 'moderate drizzle',
    55: 'dense drizzle',
    61: 'slight rain',
    63: 'moderate rain',
    65: 'heavy rain',
    71: 'slight snow',
    73: 'moderate snow',
    75: 'heavy snow',
    80: 'rain showers',
    81: 'heavy rain showers',
    82: 'violent rain showers',
    95: 'thunderstorm',
  }
  return map[code] || 'weather active'
}
