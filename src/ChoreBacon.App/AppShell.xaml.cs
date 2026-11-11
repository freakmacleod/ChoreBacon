using ChoreBacon.Services.Ui;
using ChoreBacon.Views;

namespace ChoreBacon;

public partial class AppShell : Shell
{
	public AppShell()
	{
		InitializeComponent();

		// Pushed from the family tab (parents only).
		Routing.RegisterRoute(Routes.Approvals, typeof(ApprovalsPage));
		Routing.RegisterRoute(Routes.FamilyCatalog, typeof(FamilyCatalogPage));
	}
}
