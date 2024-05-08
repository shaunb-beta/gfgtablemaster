/*
Helper functions for the application
--Dynamic Controls 
*/
sap.ui.define([
		"sap/m/Button",
		"sap/m/SegmentedButton",
		"sap/m/Text"
	],
	function(Button, SegmentedButton, Text) {
		return {
			button: function(field, variantData, oController) {
				return new sap.m.Button({
					width: "100%",
					text: field.FieldDescription,
					customData: [new sap.ui.core.CustomData({
							key: "actionBtn",
							value: field
						}),
						new sap.ui.core.CustomData({
							key: "variantData",
							value: variantData
						})
					],
					press: oController.onActionBtnPress.bind(oController)
				});
			},
			
			/*Control to download/display documents. Icon will display PDF icon*/
			download: function(field, variantData, oController) {
				return new sap.m.Button({
					width: "100%",
					// text: field.FieldDescription,
					icon: "sap-icon://pdf-attachment",
					customData: [new sap.ui.core.CustomData({
							key: "actionBtn",
							value: field
						}),
						new sap.ui.core.CustomData({
							key: "variantData",
							value: variantData
						})
					],
					press: oController.onActionBtnPress.bind(oController)
				});
			},

			approvereject: function(field, variantData, oController) {
				/*attach the select Event*/
				var buttonArr = [];
				buttonArr.push(new sap.m.SegmentedButtonItem({
					icon: "sap-icon://status-in-process",
					tooltip: oController.oBundle.getProperty("inprocess"),
					"key" : "INPROGRESS"
				}));
				buttonArr.push(new sap.m.SegmentedButtonItem({
					icon: "sap-icon://accept",
					type: sap.m.ButtonType.Accept,
					tooltip: oController.oBundle.getProperty("approve"),
					"key" : "APPROVED"
				}));
				buttonArr.push(new sap.m.SegmentedButtonItem({
					icon: "sap-icon://decline",
					type: sap.m.ButtonType.Reject,
					"tooltip": oController.oBundle.getProperty("reject"),
					"key": "REJECTED"
				}));
				
				var segBtn = new SegmentedButton({
					width: "100%",
					items: buttonArr,
					// customData: [new sap.ui.core.CustomData({
					// 		key: "actionBtn",
					// 		value: field
					// 	}),
					// 	new sap.ui.core.CustomData({
					// 		key: "variantData",
					// 		value: variantData
					// 	})]
				});
				segBtn.bindProperty("selectedKey",{
					path: field.Fieldname
				});
				
				return segBtn;
			}
		};

	});