import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const statsService = {
  async getTodayStats(userId: string) {
    const date = todayDate();

    let stats = await prisma.browsingStats.findUnique({
      where: { date_userId: { date, userId } },
    });

    if (!stats) {
      stats = await prisma.browsingStats.create({
        data: { date, userId },
      });
    }

    return stats;
  },

  async incrementTrackers(userId: string, count: number = 1, dataSavedBytes: number = 0) {
    const date = todayDate();
    return prisma.browsingStats.upsert({
      where: { date_userId: { date, userId } },
      create: { date, userId, trackersBlocked: count, dataSavedBytes },
      update: {
        trackersBlocked: { increment: count },
        dataSavedBytes: { increment: dataSavedBytes },
      },
    });
  },

  async incrementMinutes(userId: string, minutes: number = 1) {
    const date = todayDate();
    return prisma.browsingStats.upsert({
      where: { date_userId: { date, userId } },
      create: { date, userId, minutesBrowsed: minutes },
      update: { minutesBrowsed: { increment: minutes } },
    });
  },

  async recordSiteVisit(userId: string, domain: string, minutes: number = 1) {
    const date = todayDate();

    // Registrar visita al sitio
    const visit = await prisma.siteVisit.upsert({
      where: { domain_userId_date: { domain, userId, date } },
      create: { domain, userId, date, minutes },
      update: { minutes: { increment: minutes } },
    });

    // Incrementar sitesVisited (count de dominios únicos)
    const uniqueSites = await prisma.siteVisit.count({
      where: { userId, date },
    });

    await prisma.browsingStats.upsert({
      where: { date_userId: { date, userId } },
      create: { date, userId, sitesVisited: uniqueSites },
      update: { sitesVisited: uniqueSites },
    });

    // Registrar actividad horaria
    const hour = new Date().getHours();
    await prisma.hourlyActivity.upsert({
      where: { date_hour_userId: { date, hour, userId } },
      create: { date, hour, userId, hits: 1 },
      update: { hits: { increment: 1 } },
    });

    return visit;
  },

  async syncPrivacyStats(userId: string, trackersBlocked: number, dataSavedBytes: number) {
    const date = todayDate();
    return prisma.browsingStats.upsert({
      where: { date_userId: { date, userId } },
      create: { date, userId, trackersBlocked, dataSavedBytes },
      update: { trackersBlocked, dataSavedBytes },
    });
  },

  async getTopSites(userId: string, limit = 5) {
    const date = todayDate();
    return prisma.siteVisit.findMany({
      where: { userId, date },
      orderBy: { minutes: "desc" },
      take: limit,
    });
  },

  async getHourlyUsage(userId: string) {
    const date = todayDate();

    const activities = await prisma.hourlyActivity.findMany({
      where: { userId, date },
      orderBy: { hour: "asc" },
    });

    // Encontrar el máximo para calcular porcentajes relativos
    const maxHits = Math.max(1, ...activities.map((a) => a.hits));

    return Array.from({ length: 24 }, (_, i) => {
      const activity = activities.find((a) => a.hour === i);
      return {
        hour: i,
        percentage: activity ? Math.round((activity.hits / maxHits) * 100) : 0,
      };
    });
  },

  // ── Datos de los últimos N días ──
  async getWeeklyStats(userId: string, days: number = 7) {
    const now = new Date();
    const dates: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      dates.push(d);
    }

    const startDate = dates[0];
    const endDate = todayDate();

    // Stats diarias
    const dailyStats = await prisma.browsingStats.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
    });

    // Top sites en el período
    const topSitesPeriod = await prisma.siteVisit.groupBy({
      by: ["domain"],
      where: { userId, date: { gte: startDate, lte: endDate } },
      _sum: { minutes: true },
      orderBy: { _sum: { minutes: "desc" } },
      take: 5,
    });

    // Detalle diario de los top 3 sites (para sparklines)
    const top3Domains = topSitesPeriod.slice(0, 3).map((s) => s.domain);
    const siteDaily = top3Domains.length > 0
      ? await prisma.siteVisit.findMany({
          where: { userId, domain: { in: top3Domains }, date: { gte: startDate, lte: endDate } },
          orderBy: { date: "asc" },
        })
      : [];

    // Construir timeline completo (rellenar días sin datos con 0)
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const timeline = dates.map((date) => {
      const stat = dailyStats.find(
        (s) => s.date.toISOString().slice(0, 10) === date.toISOString().slice(0, 10)
      );
      return {
        date: date.toISOString().slice(0, 10),
        day: dayNames[date.getDay()],
        minutes: stat?.minutesBrowsed || 0,
        sites: stat?.sitesVisited || 0,
        trackers: stat?.trackersBlocked || 0,
      };
    });

    // Construir sparklines por sitio
    const topSitesWithTrend = top3Domains.map((domain) => {
      const totalMinutes = topSitesPeriod.find((s) => s.domain === domain)?._sum.minutes || 0;
      const trend = dates.map((date) => {
        const visit = siteDaily.find(
          (v) =>
            v.domain === domain &&
            v.date.toISOString().slice(0, 10) === date.toISOString().slice(0, 10)
        );
        return visit?.minutes || 0;
      });
      return { domain, totalMinutes, trend };
    });

    // Totales del período
    const totalMinutes = timeline.reduce((a, b) => a + b.minutes, 0);
    const totalSites = topSitesPeriod.length;
    const totalTrackers = timeline.reduce((a, b) => a + b.trackers, 0);

    return {
      timeline,
      topSites: topSitesWithTrend,
      totals: { minutes: totalMinutes, sites: totalSites, trackers: totalTrackers },
    };
  },
};