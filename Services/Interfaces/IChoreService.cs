using ChoreBacon.Models;

namespace ChoreBacon.Services.Interfaces;

public interface IChoreService
{
    Task<List<Chore>> GetChoresAsync();
    Task<List<ChoreCompletion>> GetTodayCompletionsAsync(int userId);
    Task<ChoreCompletion> CompleteChoreAsync(int choreId, int userId);
    Task<bool> IsChoreCompletedTodayAsync(int choreId, int userId);
    Task<Chore> CreateChoreAsync(Chore chore);
    Task DeleteChoreAsync(int choreId);
    Task<int> GetStreakAsync(int userId);
}
