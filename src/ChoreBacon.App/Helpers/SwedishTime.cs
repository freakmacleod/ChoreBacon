using System.Globalization;

namespace ChoreBacon.Helpers;

/// <summary>Shows instants in the business time zone (Europe/Stockholm), whatever zone the phone is set to.</summary>
public static class SwedishTime
{
    public static readonly CultureInfo Culture = CultureInfo.GetCultureInfo("sv-SE");

    private static readonly TimeZoneInfo Stockholm = TimeZoneInfo.FindSystemTimeZoneById("Europe/Stockholm");

    public static DateTimeOffset ToStockholm(DateTimeOffset instant) => TimeZoneInfo.ConvertTime(instant, Stockholm);
}
