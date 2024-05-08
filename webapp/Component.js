sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"brs_demo_tablemaster/model/models",
	"sap/ui/model/json/JSONModel"
], function (UIComponent, Device, models, JSONModel) {
	"use strict";

	return UIComponent.extend("brs_demo_tablemaster.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {

			//get the site properties and decide the destination to use
			this.getSiteSetting();

			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
		},

		getSiteSetting: function () {
			if (sap.ushell) {
				var siteService = sap.ushell.Container.getService("SiteService");
				var siteSettings = siteService.getSiteSettings();
				if (siteSettings) {
					var destModel = new JSONModel();
					destModel.setData(siteSettings);
					this.setModel(destModel, "destModel");
				}
			}
		}
	});
});