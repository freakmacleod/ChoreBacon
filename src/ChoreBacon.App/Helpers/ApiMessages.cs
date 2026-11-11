using ChoreBacon.Contracts.Family;
using ChoreBacon.Contracts.Progress;
using ChoreBacon.Resources.Strings;

namespace ChoreBacon.Helpers;

/// <summary>Maps API error codes to user-facing (Swedish) messages. Unknown codes get a generic message.</summary>
public static class ApiMessages
{
    public static string For(string code) => code switch
    {
        ProgressErrorCodes.AlreadyCompletedToday => AppResources.Error_AlreadyCompletedToday,
        ProgressErrorCodes.AlreadyCompletedThisWeek => AppResources.Error_AlreadyCompletedThisWeek,
        ProgressErrorCodes.AlreadyCompletedThisMonth => AppResources.Error_AlreadyCompletedThisMonth,
        ProgressErrorCodes.AlreadyCompleted => AppResources.Error_AlreadyCompleted,
        ProgressErrorCodes.ChoreNotFound => AppResources.Error_ChoreNotFound,
        ProgressErrorCodes.RewardNotFound => AppResources.Error_RewardNotFound,
        ProgressErrorCodes.RewardOutOfStock => AppResources.Error_OutOfStock,
        ProgressErrorCodes.InsufficientPoints => AppResources.Error_InsufficientPoints,
        FamilyErrorCodes.NoFamily => AppResources.Error_NoFamily,
        FamilyErrorCodes.AlreadyInFamily => AppResources.Error_AlreadyInFamily,
        FamilyErrorCodes.InvalidInviteCode => AppResources.Error_InvalidInviteCode,
        FamilyErrorCodes.NotParent => AppResources.Error_NotParent,
        FamilyErrorCodes.LastParent => AppResources.Error_LastParent,
        FamilyErrorCodes.NotPending or FamilyErrorCodes.CompletionNotFound or FamilyErrorCodes.RedemptionNotFound => AppResources.Error_NotPending,
        FamilyErrorCodes.MemberNotFound => AppResources.Error_MemberNotFound,
        _ => AppResources.Error_Generic,
    };

    /// <summary>True for the 409 codes that mean "already done in this window".</summary>
    public static bool IsAlreadyCompleted(string code) => code is
        ProgressErrorCodes.AlreadyCompletedToday or ProgressErrorCodes.AlreadyCompletedThisWeek or
        ProgressErrorCodes.AlreadyCompletedThisMonth or ProgressErrorCodes.AlreadyCompleted;
}
