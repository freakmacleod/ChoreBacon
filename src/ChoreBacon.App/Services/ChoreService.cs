using ChoreBacon.Models;
using ChoreBacon.Services.Interfaces;

namespace ChoreBacon.Services;

public class ChoreService : IChoreService
{
    private readonly IDatabaseService _db;

    public ChoreService(IDatabaseService db)
    {
        _db = db;
    }

    public Task<List<Chore>> GetChoresAsync() => _db.GetActiveChoresAsync();

    public Task<List<ChoreCompletion>> GetTodayCompletionsAsync(int userId) =>
        _db.GetCompletionsForUserTodayAsync(userId);

    public async Task<ChoreCompletion> CompleteChoreAsync(int choreId, int userId)
    {
        var chores = await _db.GetActiveChoresAsync();
        var chore = chores.FirstOrDefault(c => c.Id == choreId)
            ?? throw new InvalidOperationException($"Chore {choreId} not found.");

        if (await IsChoreCompletedTodayAsync(choreId, userId))
            throw new InvalidOperationException("Chore already completed today.");

        var completion = new ChoreCompletion
        {
            ChoreId = choreId,
            UserId = userId,
            PointsEarned = chore.PointValue,
            CompletedAt = DateTime.UtcNow
        };
        await _db.SaveChoreCompletionAsync(completion);

        // Update user points
        var user = await _db.GetUserByIdAsync(userId)
            ?? throw new InvalidOperationException($"User {userId} not found.");
        user.TotalPoints += chore.PointValue;
        await _db.SaveUserAsync(user);

        // Record transaction
        await _db.SaveTransactionAsync(new PointTransaction
        {
            UserId = userId,
            Amount = chore.PointValue,
            Type = TransactionType.ChoreCompleted,
            Description = $"Completed: {chore.Name}",
            ReferenceId = choreId
        });

        return completion;
    }

    public async Task<bool> IsChoreCompletedTodayAsync(int choreId, int userId)
    {
        var todayCompletions = await _db.GetCompletionsForUserTodayAsync(userId);
        return todayCompletions.Any(c => c.ChoreId == choreId);
    }

    public async Task<Chore> CreateChoreAsync(Chore chore)
    {
        await _db.SaveChoreAsync(chore);
        return chore;
    }

    public async Task DeleteChoreAsync(int choreId)
    {
        var chores = await _db.GetActiveChoresAsync();
        var chore = chores.FirstOrDefault(c => c.Id == choreId);
        if (chore is not null)
        {
            chore.IsActive = false;
            await _db.SaveChoreAsync(chore);
        }
    }

    public Task<int> GetStreakAsync(int userId) => _db.GetUserStreakAsync(userId);

    public async Task SeedDefaultChoresAsync()
    {
        var existing = await _db.GetActiveChoresAsync();
        if (existing.Count > 0)
            return;

        var defaults = new List<Chore>
        {
            new() { Name = "Wash Dishes",        PointValue = 10, Frequency = ChoreFrequency.Daily,   IconName = "dishes",     Description = "Clean all dishes in the sink" },
            new() { Name = "Vacuum Living Room",  PointValue = 15, Frequency = ChoreFrequency.Weekly,  IconName = "vacuum",     Description = "Vacuum the living room floor" },
            new() { Name = "Take Out Trash",      PointValue = 10, Frequency = ChoreFrequency.Daily,   IconName = "trash",      Description = "Empty bins and take out trash" },
            new() { Name = "Do Laundry",          PointValue = 20, Frequency = ChoreFrequency.Weekly,  IconName = "laundry",    Description = "Wash, dry and fold a load of laundry" },
            new() { Name = "Clean Bathroom",      PointValue = 25, Frequency = ChoreFrequency.Weekly,  IconName = "bathroom",   Description = "Scrub toilet, sink and shower" },
            new() { Name = "Mow Lawn",            PointValue = 30, Frequency = ChoreFrequency.Weekly,  IconName = "lawn",       Description = "Mow the front and back lawn" },
            new() { Name = "Feed Pets",           PointValue = 5,  Frequency = ChoreFrequency.Daily,   IconName = "pet",        Description = "Feed and water the pets" },
            new() { Name = "Make Bed",            PointValue = 5,  Frequency = ChoreFrequency.Daily,   IconName = "bed",        Description = "Make your bed neatly" },
        };

        foreach (var chore in defaults)
            await _db.SaveChoreAsync(chore);
    }
}
