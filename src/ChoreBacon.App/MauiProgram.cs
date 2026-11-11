using ChoreBacon.Services;
using ChoreBacon.Services.Api;
using ChoreBacon.Services.Auth;
using ChoreBacon.Services.Interfaces;
using ChoreBacon.Services.Ui;
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

        // ── Platform ──────────────────────────────────────────────────────────
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddSingleton(SecureStorage.Default);
        builder.Services.AddSingleton(WebAuthenticator.Default);

        // ── API + auth ────────────────────────────────────────────────────────
        var apiConfig = ApiConfig.FromAssemblyMetadata();
        builder.Services.AddSingleton(apiConfig);
        builder.Services.AddSingleton<ITokenStore, SecureTokenStore>();
        builder.Services.AddSingleton<TokenManager>();
        builder.Services.AddTransient<AuthenticatedHttpHandler>();

        // Token endpoints must not go through AuthenticatedHttpHandler (it would recurse into refresh).
        builder.Services.AddHttpClient<IAuthApi, AuthApiClient>(c => c.BaseAddress = apiConfig.BaseAddress);
        builder.Services.AddHttpClient<IChoreBaconApi, ChoreBaconApiClient>(c => c.BaseAddress = apiConfig.BaseAddress)
            .AddHttpMessageHandler<AuthenticatedHttpHandler>();
        builder.Services.AddHttpClient<IFamilyApi, FamilyApiClient>(c => c.BaseAddress = apiConfig.BaseAddress)
            .AddHttpMessageHandler<AuthenticatedHttpHandler>();

        // ── Services ──────────────────────────────────────────────────────────
        builder.Services.AddSingleton<IAuthService, AuthService>();
        builder.Services.AddSingleton<INavigator, ShellNavigator>();
        builder.Services.AddSingleton<IDialogs, ShellDialogs>();

        // ── ViewModels ────────────────────────────────────────────────────────
        builder.Services.AddTransient<LoginViewModel>();
        builder.Services.AddTransient<DashboardViewModel>();
        builder.Services.AddTransient<ChoresViewModel>();
        builder.Services.AddTransient<StoreViewModel>();
        builder.Services.AddTransient<AchievementsViewModel>();
        builder.Services.AddTransient<FamilyViewModel>();
        builder.Services.AddTransient<ApprovalsViewModel>();
        builder.Services.AddTransient<FamilyCatalogViewModel>();

        // ── Views ─────────────────────────────────────────────────────────────
        builder.Services.AddTransient<LoginPage>();
        builder.Services.AddTransient<DashboardPage>();
        builder.Services.AddTransient<ChoresPage>();
        builder.Services.AddTransient<StorePage>();
        builder.Services.AddTransient<AchievementsPage>();
        builder.Services.AddTransient<FamilyPage>();
        builder.Services.AddTransient<ApprovalsPage>();
        builder.Services.AddTransient<FamilyCatalogPage>();

        // ── App Shell ─────────────────────────────────────────────────────────
        builder.Services.AddSingleton<AppShell>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}
