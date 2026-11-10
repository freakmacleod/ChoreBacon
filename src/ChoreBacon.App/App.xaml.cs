using ChoreBacon.Services;
using ChoreBacon.Services.Interfaces;

namespace ChoreBacon;

public partial class App : Application
{
    private readonly IServiceProvider _services;

    public App(IServiceProvider services)
    {
        InitializeComponent();
        _services = services;
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        return new Window(_services.GetRequiredService<AppShell>());
    }

    protected override async void OnStart()
    {
        base.OnStart();

        // Initialize DB and seed default data
        var db = _services.GetRequiredService<IDatabaseService>();
        await db.InitializeAsync();

        var choreService = _services.GetRequiredService<IChoreService>() as ChoreService;
        if (choreService is not null)
            await choreService.SeedDefaultChoresAsync();

        var storeService = _services.GetRequiredService<IStoreService>() as StoreService;
        if (storeService is not null)
            await storeService.SeedDefaultRewardsAsync();

        var achievementService = _services.GetRequiredService<IAchievementService>();
        await achievementService.SeedDefaultAchievementsAsync();
    }
}
