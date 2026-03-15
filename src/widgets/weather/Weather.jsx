import { useState, useEffect } from 'react'
import styles from './Weather.module.css'

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY
const DEFAULT_CITY = import.meta.env.VITE_WEATHER_CITY ?? 'Dallas'

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

  useEffect(() => {
    if (!API_KEY || API_KEY === 'PLACEHOLDER') {
      setLoading(false)
      setError('no-key')
      return
    }

    async function load() {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(DEFAULT_CITY)}&appid=${API_KEY}&units=imperial`
        )
        const json = await res.json()
        if (json.cod !== 200) throw new Error(json.message)
        setData({
          city:        json.name,
          temp:        Math.round(json.main.temp),
          feels:       Math.round(json.main.feels_like),
          high:        Math.round(json.main.temp_max),
          low:         Math.round(json.main.temp_min),
          humidity:    json.main.humidity,
          description: json.weather[0].description,
          icon:        json.weather[0].icon,
          wind:        Math.round(json.wind.speed),
        })
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
    <div className={styles.widget}>
      <div className={styles.label}>WEATHER</div>

      {loading && <div className={styles.status}>SCANNING...</div>}

      {error === 'no-key' && (
        <div className={styles.noKey}>
          <div className={styles.noKeyIcon}>◈</div>
          <div className={styles.noKeyText}>Add VITE_OPENWEATHER_API_KEY to .env</div>
        </div>
      )}

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
        </>
      )}
    </div>
  )
}
