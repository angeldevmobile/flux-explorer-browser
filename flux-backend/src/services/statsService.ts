import db from "../config/db";
import crypto from "crypto";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const statsService = {
  getTodayStats(userId: string) {
    const date = todayStr();
    let stats = db.prepare("SELECT * FROM BrowsingStats WHERE date = ? AND userId = ?").get(date, userId);
    if (!stats) {
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO BrowsingStats (id, date, userId) VALUES (?, ?, ?)").run(id, date, userId);
      stats = db.prepare("SELECT * FROM BrowsingStats WHERE id = ?").get(id);
    }
    return stats;
  },

  incrementTrackers(userId: string, count = 1, dataSavedBytes = 0) {
    const date = todayStr();
    const existing = db.prepare("SELECT id FROM BrowsingStats WHERE date = ? AND userId = ?").get(date, userId);
    if (existing) {
      db.prepare(
        "UPDATE BrowsingStats SET trackersBlocked = trackersBlocked + ?, dataSavedBytes = dataSavedBytes + ? WHERE date = ? AND userId = ?"
      ).run(count, dataSavedBytes, date, userId);
    } else {
      db.prepare(
        "INSERT INTO BrowsingStats (id, date, userId, trackersBlocked, dataSavedBytes) VALUES (?, ?, ?, ?, ?)"
      ).run(crypto.randomUUID(), date, userId, count, dataSavedBytes);
    }
    return db.prepare("SELECT * FROM BrowsingStats WHERE date = ? AND userId = ?").get(date, userId);
  },

  incrementMinutes(userId: string, minutes = 1) {
    const date = todayStr();
    const existing = db.prepare("SELECT id FROM BrowsingStats WHERE date = ? AND userId = ?").get(date, userId);
    if (existing) {
      db.prepare(
        "UPDATE BrowsingStats SET minutesBrowsed = minutesBrowsed + ? WHERE date = ? AND userId = ?"
      ).run(minutes, date, userId);
    } else {
      db.prepare(
        "INSERT INTO BrowsingStats (id, date, userId, minutesBrowsed) VALUES (?, ?, ?, ?)"
      ).run(crypto.randomUUID(), date, userId, minutes);
    }
    return db.prepare("SELECT * FROM BrowsingStats WHERE date = ? AND userId = ?").get(date, userId);
  },

  recordSiteVisit(userId: string, domain: string, minutes = 1) {
    const date = todayStr();

    const existing = db.prepare(
      "SELECT id FROM SiteVisit WHERE domain = ? AND userId = ? AND date = ?"
    ).get(domain, userId, date);
    if (existing) {
      db.prepare(
        "UPDATE SiteVisit SET minutes = minutes + ? WHERE domain = ? AND userId = ? AND date = ?"
      ).run(minutes, domain, userId, date);
    } else {
      db.prepare(
        "INSERT INTO SiteVisit (id, domain, userId, date, minutes) VALUES (?, ?, ?, ?, ?)"
      ).run(crypto.randomUUID(), domain, userId, date, minutes);
    }

    const uniqueSites = (db.prepare(
      "SELECT COUNT(DISTINCT domain) as c FROM SiteVisit WHERE userId = ? AND date = ?"
    ).get(userId, date) as { c: number }).c;

    const statsExisting = db.prepare("SELECT id FROM BrowsingStats WHERE date = ? AND userId = ?").get(date, userId);
    if (statsExisting) {
      db.prepare(
        "UPDATE BrowsingStats SET sitesVisited = ? WHERE date = ? AND userId = ?"
      ).run(uniqueSites, date, userId);
    } else {
      db.prepare(
        "INSERT INTO BrowsingStats (id, date, userId, sitesVisited) VALUES (?, ?, ?, ?)"
      ).run(crypto.randomUUID(), date, userId, uniqueSites);
    }

    const hour = new Date().getHours();
    const hourExisting = db.prepare(
      "SELECT id FROM HourlyActivity WHERE date = ? AND hour = ? AND userId = ?"
    ).get(date, hour, userId);
    if (hourExisting) {
      db.prepare(
        "UPDATE HourlyActivity SET hits = hits + 1 WHERE date = ? AND hour = ? AND userId = ?"
      ).run(date, hour, userId);
    } else {
      db.prepare(
        "INSERT INTO HourlyActivity (id, date, hour, userId, hits) VALUES (?, ?, ?, ?, 1)"
      ).run(crypto.randomUUID(), date, hour, userId);
    }

    return db.prepare("SELECT * FROM SiteVisit WHERE domain = ? AND userId = ? AND date = ?").get(domain, userId, date);
  },

  syncPrivacyStats(userId: string, trackersBlocked: number, dataSavedBytes: number) {
    const date = todayStr();
    const existing = db.prepare("SELECT id FROM BrowsingStats WHERE date = ? AND userId = ?").get(date, userId);
    if (existing) {
      db.prepare(
        "UPDATE BrowsingStats SET trackersBlocked = ?, dataSavedBytes = ? WHERE date = ? AND userId = ?"
      ).run(trackersBlocked, dataSavedBytes, date, userId);
    } else {
      db.prepare(
        "INSERT INTO BrowsingStats (id, date, userId, trackersBlocked, dataSavedBytes) VALUES (?, ?, ?, ?, ?)"
      ).run(crypto.randomUUID(), date, userId, trackersBlocked, dataSavedBytes);
    }
    return db.prepare("SELECT * FROM BrowsingStats WHERE date = ? AND userId = ?").get(date, userId);
  },

  getTopSites(userId: string, limit = 5) {
    const date = todayStr();
    return db.prepare(
      "SELECT * FROM SiteVisit WHERE userId = ? AND date = ? ORDER BY minutes DESC LIMIT ?"
    ).all(userId, date, limit);
  },

  getHourlyUsage(userId: string) {
    const date = todayStr();
    const activities = db.prepare(
      "SELECT hour, hits FROM HourlyActivity WHERE userId = ? AND date = ? ORDER BY hour ASC"
    ).all(userId, date) as { hour: number; hits: number }[];

    const maxHits = Math.max(1, ...activities.map((a) => a.hits));
    return Array.from({ length: 24 }, (_, i) => {
      const activity = activities.find((a) => a.hour === i);
      return { hour: i, percentage: activity ? Math.round((activity.hits / maxHits) * 100) : 0 };
    });
  },

  getWeeklyStats(userId: string, days = 7) {
    const now = new Date();
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    const dailyStats = db.prepare(
      "SELECT * FROM BrowsingStats WHERE userId = ? AND date >= ? AND date <= ? ORDER BY date ASC"
    ).all(userId, startDate, endDate) as { date: string; minutesBrowsed: number; sitesVisited: number; trackersBlocked: number }[];

    const topSitesPeriod = db.prepare(
      "SELECT domain, SUM(minutes) as totalMinutes FROM SiteVisit WHERE userId = ? AND date >= ? AND date <= ? GROUP BY domain ORDER BY totalMinutes DESC LIMIT 5"
    ).all(userId, startDate, endDate) as { domain: string; totalMinutes: number }[];

    const top3Domains = topSitesPeriod.slice(0, 3).map((s) => s.domain);
    let siteDaily: { domain: string; date: string; minutes: number }[] = [];
    if (top3Domains.length > 0) {
      const placeholders = top3Domains.map(() => '?').join(',');
      siteDaily = db.prepare(
        `SELECT domain, date, minutes FROM SiteVisit WHERE userId = ? AND domain IN (${placeholders}) AND date >= ? AND date <= ? ORDER BY date ASC`
      ).all(userId, ...top3Domains, startDate, endDate) as { domain: string; date: string; minutes: number }[];
    }

    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const timeline = dates.map((dateStr) => {
      const stat = dailyStats.find((s) => s.date.slice(0, 10) === dateStr);
      const d = new Date(dateStr + 'T12:00:00');
      return {
        date: dateStr,
        day: dayNames[d.getDay()],
        minutes: stat?.minutesBrowsed || 0,
        sites: stat?.sitesVisited || 0,
        trackers: stat?.trackersBlocked || 0,
      };
    });

    const topSitesWithTrend = top3Domains.map((domain) => {
      const totalMinutes = topSitesPeriod.find((s) => s.domain === domain)?.totalMinutes || 0;
      const trend = dates.map((dateStr) => {
        const visit = siteDaily.find((v) => v.domain === domain && v.date.slice(0, 10) === dateStr);
        return visit?.minutes || 0;
      });
      return { domain, totalMinutes, trend };
    });

    return {
      timeline,
      topSites: topSitesWithTrend,
      totals: {
        minutes: timeline.reduce((a, b) => a + b.minutes, 0),
        sites: topSitesPeriod.length,
        trackers: timeline.reduce((a, b) => a + b.trackers, 0),
      },
    };
  },
};
