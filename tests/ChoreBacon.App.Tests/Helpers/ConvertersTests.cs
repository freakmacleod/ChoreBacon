using System.Globalization;
using ChoreBacon.Helpers;

namespace ChoreBacon.App.Tests.Helpers;

public class ConvertersTests
{
    private static object Convert(IValueConverter converter, object? value) =>
        converter.Convert(value, typeof(object), null, CultureInfo.InvariantCulture);

    [Theory]
    [InlineData("hej", true)]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData(null, false)]
    public void StringToBool_is_true_only_for_non_blank_strings(string? value, bool expected) =>
        Assert.Equal(expected, Convert(new StringToBoolConverter(), value));

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public void InverseBool_negates(bool value, bool expected) =>
        Assert.Equal(expected, Convert(new InverseBoolConverter(), value));

    [Theory]
    [InlineData(5, true)]
    [InlineData(0, false)]
    [InlineData(-1, false)]
    public void IntToBool_is_true_only_for_positive_values(int value, bool expected) =>
        Assert.Equal(expected, Convert(new IntToBoolConverter(), value));

    [Theory]
    [InlineData(true, 1.0)]
    [InlineData(false, 0.4)]
    public void BoolToOpacity_dims_false(bool value, double expected) =>
        Assert.Equal(expected, Convert(new BoolToOpacityConverter(), value));
}
