using ChoreBacon.Services.Api;

namespace ChoreBacon.App.Tests.Services;

public class ApiConfigTests
{
    [Theory]
    [InlineData("https://chorebacon.vercel.app")]
    [InlineData("https://chorebacon.vercel.app/")]
    public void Base_address_always_ends_with_a_slash(string baseUrl)
    {
        var config = new ApiConfig(new Uri(baseUrl));

        Assert.Equal("https://chorebacon.vercel.app/", config.BaseAddress.AbsoluteUri);
        Assert.Equal("https://chorebacon.vercel.app/api/v1/auth/facebook/start", config.AuthStartUri("facebook").AbsoluteUri);
    }

    [Fact]
    public void Base_url_is_baked_in_at_build_time()
    {
        Assert.Equal("http", ApiConfig.FromAssemblyMetadata().BaseAddress.Scheme[..4]);
    }
}
