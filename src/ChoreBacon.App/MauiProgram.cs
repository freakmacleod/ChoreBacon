using ChoreBacon.Services;
using ChoreBacon.Services.Interfaces;
using ChoreBacon.ViewModels;
using ChoreBacon.Views;
using CommunityToolkit.Maui;
using Microsoft.Extensions.Logging;

namespace ChoreBacon;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .UseMauiCommunityToolkit()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

        // ── Services ──────────────────────────────────────────────────────────
        builder.Services.AddSingleton<IDatabaseService, DatabaseService>();
        builder.Services.AddSingleton<IAuthService, AuthService>();
        builder.Services.AddSingleton<IChoreService, ChoreService>();
        builder.Services.AddSingleton<IAchievementService, AchievementService>();
        builder.Services.AddSingleton<IStoreService, StoreService>();

        // ── ViewModels ────────────────────────────────────────────────────────
        builder.Services.AddTransient<LoginViewModel>();
        builder.Services.AddTransient<DashboardViewModel>();
        builder.Services.AddTransient<ChoresViewModel>();
        builder.Services.AddTransient<StoreViewModel>();
        builder.Services.AddTransient<AchievementsViewModel>();

        // ── Views ─────────────────────────────────────────────────────────────
        builder.Services.AddTransient<LoginPage>();
        builder.Services.AddTransient<DashboardPage>();
        builder.Services.AddTransient<ChoresPage>();
        builder.Services.AddTransient<StorePage>();
        builder.Services.AddTransient<AchievementsPage>();

        // ── App Shell ─────────────────────────────────────────────────────────
        builder.Services.AddSingleton<AppShell>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}
