using Android.App;
using Android.Runtime;

namespace ChoreBacon;

#if DEBUG
// Debug builds talk to the local API over http (http://10.0.2.2:3000 from the emulator).
[Application(UsesCleartextTraffic = true)]
#else
[Application]
#endif
public class MainApplication : MauiApplication
{
	public MainApplication(IntPtr handle, JniHandleOwnership ownership)
		: base(handle, ownership)
	{
	}

	protected override MauiApp CreateMauiApp() => MauiProgram.CreateMauiApp();
}
