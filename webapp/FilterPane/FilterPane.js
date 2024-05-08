jQuery.sap.declare("brs_demo_tablemaster.controller.FilterPane");

sap.ui.define([
	"sap/m/MessageBox",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/odata/ODataModel",
	"brs_demo_tablemaster/utilities/Utilities",
	"brs_demo_tablemaster/FilterPane/FilterUtils"
], function (MessageBox, JSONModel, ODataModel, Utilities, FilterUtils) {
	return {
		loadFilterUI: function (variantData, controller) {
			this.controller = controller;
			var filterPaneForm = controller.getView().byId("idBRSFilterPaneForm");
			this.setAdvancedFilterCount(controller, "idBRSFilterPaneAdvL", variantData);
			if (filterPaneForm) {
				filterPaneForm.setBusy(true);
			}
			var filterPaneDataModel = new JSONModel();
			if (variantData && variantData.FilterPanel && variantData.FilterPanel.Fields) {
				filterPaneDataModel.setData(variantData.FilterPanel.Fields);
				filterPaneDataModel.setSizeLimit(variantData.FilterPanel.Fields.length);
				controller.getView().setModel(filterPaneDataModel, "filterPaneDataModel");
			}

			jQuery.sap.delayedCall(100, controller, function () {
				filterPaneForm.setBusy(false);
			}, filterPaneForm);
		},

		/*Display the already set inital Filters in the Left side Filter Pane*/
		setInitialFilters: function (UIControl, controller) {
			var controlType = UIControl.data("selectionControl");
			var dataF, fltrVal;
			switch (controlType && controlType.toLowerCase()) {
			case "single":
			case "multi":
				dataF = UIControl.getItems()[1];
				if (dataF && dataF instanceof sap.m.MultiInput) {
					var fltrInfo = dataF.data("fltrLoadInfo");
					var multiSelect = (fltrInfo.SelectionControl && fltrInfo.SelectionControl === "Single") ? false : true;
					this.loadFPDialogData(dataF, controller, multiSelect, true);
				} else if (dataF && (dataF instanceof sap.m.ComboBox || dataF instanceof sap.m.MultiComboBox)) {
					this.loadFFData(dataF, true);
				}
				break;
			case "specialrange":
			case "range":
				dataF = UIControl.getItems()[1];
				if (dataF && (dataF instanceof sap.m.ComboBox || dataF instanceof sap.m.MultiComboBox)) {
					this.loadFFData(dataF, true);
				}
				break;
			case "rangenumber":
				dataF = UIControl.getItems()[1];
				if (dataF && (dataF instanceof sap.m.Input)) {
					fltrVal = dataF.data("fltrLoadInfo").DefaultFilterVal[0];
					if (fltrVal.val_low && !isNaN(fltrVal.val_low)) {
						dataF.setDateValue(fltrVal.val_low);
					}
					if (fltrVal.val_high && !isNaN(fltrVal.val_high)) {
						dataF.setSecondDateValue(fltrVal.val_high);
					}
				}
				break;
			case "rangedate":
				//Set the dates. Data not to be loaded.
				dataF = UIControl.getItems()[1];
				if (dataF && (dataF instanceof sap.m.DateRangeSelection)) {
					fltrVal = dataF.data("fltrLoadInfo").DefaultFilterVal[0];
					if (fltrVal.val_low && !isNaN(new Date(fltrVal.val_low))) {
						dataF.setDateValue(new Date(fltrVal.val_low));
					}
					if (fltrVal.val_high && !isNaN(new Date(fltrVal.val_high))) {
						dataF.setSecondDateValue(new Date(fltrVal.val_high));
					}

				}
				break;
			default:
			}
		},

		loadFPDialogData: function (src, controller, multiSelect, bInit) {
			/*Enable Lazy loading from Dialog based Filters*/
			/*Load the Data in select Dialog*/
			var fltrInfoData = src.data("fltrLoadInfo");
			var variantData = src.data("variantData");

			if (!fltrInfoData && !variantData) {
				MessageBox.alert(controller.oBundle.getProperty("err_gen"));
				jQuery.sap.log.error("No Filter Pane Info or variant Data");
				return;
			}

			src.setBusyIndicatorDelay(0);
			src.setBusy(false);
			var queryPath = variantData.ServEntity;
			var service = variantData.Service.startsWith("/") ? controller.serviceURL + variantData.Service :
				controller.serviceURL + "/" + variantData.Service;

			var oFPDiagModel = new ODataModel(service, {
				json: true,
				defaultCountMode: sap.ui.model.odata.CountMode.None
			});
			oFPDiagModel.setDefaultCountMode(sap.ui.model.odata.CountMode.None);

			//Check for parameters defined in the config
			var paramStr = this.createParamStr(variantData.Fields);
			if (paramStr === false) {
				return;
			}
			if (paramStr !== undefined) {
				queryPath += "Parameters" + paramStr;
			}

			var selectParams = fltrInfoData.Fieldname + ",";
			if (fltrInfoData.AddDisplayField) {
				selectParams = selectParams + fltrInfoData.AddDisplayField + ",";
			}
			//remove the last comma
			selectParams = selectParams.replace(/,([^,]*)$/, "$1");

			var oItemTemplate = new sap.m.StandardListItem({
				title: fltrInfoData.AddDisplayField ? "{" + fltrInfoData.AddDisplayField + "}" : "",
				info: "{" + fltrInfoData.Fieldname + "}"
			});

			//Define the Selection Dialog
			var oSelectDialog = new sap.m.SelectDialog({
				title: fltrInfoData.FieldDescription,
				multiSelect: multiSelect,
				rememberSelections: true
			}).addStyleClass("fpSelectDialog");
			oSelectDialog.addCustomData(new sap.ui.core.CustomData({
				key: "fltrLoadInfo",
				value: fltrInfoData
			}));
			oSelectDialog.attachLiveChange(function (oEvt) {
				var fltrInfo = oEvt.getSource().data("fltrLoadInfo"),
					oBinding = oEvt.getSource().getBinding("items"),
					sQuery = oEvt.getParameter("value"),
					aFilters;
				var f1 = new sap.ui.model.Filter(fltrInfo.Fieldname, sap.ui.model.FilterOperator.Contains, sQuery);
				if (fltrInfo.AddDisplayField) {
					var f2 = new sap.ui.model.Filter(fltrInfo.AddDisplayField, sap.ui.model.FilterOperator.Contains, sQuery);
				}

				if (f2) {
					aFilters = new sap.ui.model.Filter({
						filters: [f1, f2],
						and: false
					});
				} else {
					aFilters = f1;
				}
				oBinding.filter([aFilters]);
			}, this);

			var that = this;

			oSelectDialog.attachConfirm({
				srcCtrl: src
			}, function (oEvt, oData) {
				var selectedContexts = oEvt.getParameter("selectedContexts");
				var srcCtrl = oData.srcCtrl;
				srcCtrl.destroyTokens();
				var fltrData = srcCtrl.data("fltrLoadInfo");
				selectedContexts.forEach(function (sContext) {
					srcCtrl.addToken(new sap.m.Token({
						key: sContext.getProperty(fltrData.Fieldname),
						text: sContext.getProperty(fltrData.AddDisplayField || fltrData.Fieldname)
					}));
				}, this);
			}, this);
			oSelectDialog.setModel(oFPDiagModel);
			oSelectDialog.bindAggregation("items", {
				path: "/" + queryPath,
				parameters: {
					select: selectParams,
					custom: {
						AppID: this.controller.variantData.AppID,
						AppVariantID: this.controller.variantData.AppVariantID
					}
				},
				template: oItemTemplate
			});

			//Initial Filters and already selected values.
			var valTokens;
			if (bInit && bInit === true) {
				src.setBusy(true);
				var fltrConfData = fltrInfoData.DefaultFilterVal;
				if (!fltrConfData || !fltrConfData.length || !fltrConfData.length > 0) {
					return;
				}
				valTokens = [];
				fltrConfData.forEach(function (obj) {
					if (obj.val_low) {
						valTokens.push(obj.val_low);
					}
				}, this);
				var fData = oFPDiagModel.getData();
				if (!fData) {
					src.setBusy(false);
					return;
				}
				// var cThis = this;
				if (valTokens && valTokens.length > 0) {
					fData.filter(function (fObj) {
						if (valTokens.indexOf(fObj[fltrInfoData.Fieldname]) > -1) {
							src.addToken(new sap.m.Token({
								key: fObj[fltrInfoData.Fieldname],
								text: fObj[fltrInfoData.AddDisplayField || fltrInfoData.Fieldname]
							}));
						}
					}, this);
				}
			} else {
				/*select the already selected items*/
				var items = oSelectDialog.getItems();
				valTokens = src.getTokens();
				items.forEach(function (item) {
					var currItem = item;
					item.setSelected(false);
					valTokens.forEach(function (valToken) {
						if (valToken.getKey() === currItem.getInfo()) {
							currItem.setSelected(true);
						}
					}, this);
				}, this);
				oSelectDialog.open();
			}
			src.setBusy(false);

		},

		loadFFData: function (oval, bInit, isDataForDialog, isSpecialFilter) {
			var target, src, fltrInfoData, variantData, oDataModel;
			target = oval.getId();
			fltrInfoData = oval.data("fltrLoadInfo");
			variantData = oval.data("variantData");

			src = sap.ui.getCore().byId(target);
			if (fltrInfoData) {
				var queryType = fltrInfoData.ValueHelpType;
				var controlType = fltrInfoData.SelectionControl;
				var template, callPath = variantData.ServEntity,
					service;
				switch (queryType.toLowerCase()) {
				case "query":
					//No query to be called for Date Range/
					if (controlType.toLowerCase() === "rangedate") {
						this.setSelectedValues(src, fltrInfoData, variantData);
						return;
					}

					//Load the data from the same query as the Variant service
					if (!isDataForDialog && src.getModel()) {
						src.setBusy(false);
						return;
					}

					src.setBusy(true);
					var qryModel = new JSONModel();
					qryModel.setData({});
					service = variantData.Service.startsWith("/") ? this.controller.serviceURL + variantData.Service :
						this.controller.serviceURL + "/" + variantData.Service;
					oDataModel = new ODataModel(service, {
						json: true
					});

					var paramStr = this.createParamStr(variantData.Fields);
					if (paramStr === false) {
						return;
					}
					if (paramStr !== undefined) {
						callPath += "Parameters" + paramStr;
					}

					if (controlType && controlType.toLowerCase() === "multi") {
						template = new sap.ui.core.ListItem({
							key: "{" + fltrInfoData.Fieldname + "}",
							text: fltrInfoData.AddDisplayField ? "{" + fltrInfoData.AddDisplayField + "} {" + fltrInfoData.Fieldname + "}" : "{" +
								fltrInfoData.Fieldname + "}",
							additionalText: fltrInfoData.AddDisplayField ? "{" + fltrInfoData.AddDisplayField + "}" : ""
						});
					} else {
						template = new sap.ui.core.ListItem({
							key: "{" + fltrInfoData.Fieldname + "}",
							text: "{" + (fltrInfoData.AddDisplayField || fltrInfoData.Fieldname) + "}",
							additionalText: fltrInfoData.AddDisplayField ? "{" + fltrInfoData.AddDisplayField + "}" : ""
						});
					}
					if (!isDataForDialog) {
						src.bindItems("/", template);
					}

					var selectParams = fltrInfoData.AddDisplayField ? fltrInfoData.Fieldname + "," + fltrInfoData.AddDisplayField :
						fltrInfoData.Fieldname;
					oDataModel.read("/" + callPath, {
						urlParameters: {
							$select: selectParams
						},
						async: (isDataForDialog && isDataForDialog === true) ? false : true,
						success: $.proxy(function (oData) {
							var data = oData.results;
							if (isDataForDialog && isDataForDialog === true) {
								this.fpDialogData = data;
								return;
							}
							if (fltrInfoData.SelectionControl && fltrInfoData.SelectionControl === "Multi") {
								var all = {};
								all[fltrInfoData.Fieldname] = "All";
								all[fltrInfoData.AddDisplayField] = "All";
								data.splice(0, 0, all);
							}
							qryModel.setSizeLimit(oData.results.length);
							qryModel.setData(data);
							src.setModel(qryModel);
							this.setSelectedValues(src, fltrInfoData, variantData);
							src.setBusy(false);
						}, this),
						error: $.proxy(function (oErr) {
							src.setBusy(false);
						}, this)
					});
					break;
				case "fixed":
					//Load the data from the same query as the Variant service
					if (src.getModel()) {
						return;
					}
					src.setBusy(true);

					var path = this.controller.modulePath;
					var fxModel = new JSONModel(path + "/model/Periods.json", false);
					fxModel.attachRequestCompleted(function () {
						fxModel.setData(fxModel.getData().results);
						src.setModel(fxModel);
						src.setBusy(false);
						this.setSelectedValues(src, fltrInfoData, variantData);
					}, this);
					template = new sap.ui.core.ListItem({
						key: "{key}",
						text: "{text}"
					});
					src.bindItems("/", template);
					break;
				default:

				}
			}
		},

		/*load the default Filters and set the selected Keys.
			Check if this is the initial load and prevent setting values for the control if complex configuration already exists.
		*/
		setSelectedValues: function (control, fltrInfoData, variantData) {
			//set the selected Filter values to be checked
			var dfArr = fltrInfoData.DefaultFilterVal;
			var controlType = fltrInfoData.SelectionControl;
			switch (fltrInfoData.ValueHelpType.toLowerCase()) {
			case "query":
				if (dfArr && dfArr.length && dfArr.length > 0) {
					if (controlType.toLowerCase() === "single" || controlType.toLowerCase() === "multi") {
						var valArr = [];
						dfArr.forEach(function (dfObj) {
							var value = dfObj.val_low;
							if (value) {
								valArr.push(value);
							}
						}, this);

						if (control instanceof sap.m.MultiComboBox) {
							control.setSelectedKeys(valArr);
						} else {
							control.setSelectedKey(valArr[0]);
						}

					} else if (controlType.toLowerCase() === "range") {
						//TODO:

					} else if (controlType.toLowerCase() === "rangedate") {
						dfArr.forEach(function (dfObj) {
							var fromD = dfObj.val_low;
							var toD = dfObj.val_high;

							if (fromD && !isNaN(Date.parse(fromD))) {
								control.setDateValue(fromD);
							}

							if (toD && !isNaN(Date.parse(toD))) {
								control.setSecondDateValue(toD);
							}
						}, this);
					}
				}
				break;
			case "fixed":
				if (controlType.toLowerCase() === "specialrange") {
					/*If not default Value set, set it to YTD*/
					if (!dfArr) {
						return;
					}
					//data always stored in val_low property
					var spValue = dfArr[0].val_low;
					if (spValue && spValue.toLowerCase() && spValue.toLowerCase() !== "custom") {
						var val_low = dfArr[0].val_low;
						var val_high = dfArr[0].val_high;
						if (val_low && val_high) {
							spValue = "Custom";
						}
					}
					control.setSelectedKey(spValue);
					var service, callPath;
					var fromCtrl = control.getParent().getItems()[2].getItems()[1];
					var toCtrl = control.getParent().getItems()[2].getItems()[3];
					var template, spModel = new JSONModel();

					spModel.setData();
					if (spValue === "Custom") {
						fromCtrl.setEnabled(true);
						toCtrl.setEnabled(true);
						/*Check for JumpTo from and To*/
						if (this.controller.jumpTo) {
							var jtPeriod;
							//replace with filter for IE and edge
							if (sap.ui.Device.browser.msie || sap.ui.Device.browser.edge) {
								jtPeriod = this.controller.jumpToData.find(function (jumpObj) {
									return jumpObj.Fieldname === fltrInfoData.Fieldname;
								}, this);
								if (jtPeriod && jtPeriod.length > 0) {
									jtPeriod = jtPeriod[0];
								}
							} else {
								jtPeriod = this.controller.jumpToData.find(function (jumpObj) {
									return jumpObj.Fieldname === fltrInfoData.Fieldname;
								}, this);
							}
						}

						if (jtPeriod) {
							var fromVal = jtPeriod.val_low;
							var toVal = jtPeriod.val_high;
						} else if (val_low && val_high) {
							fromVal = val_low;
							toVal = val_high;
						}
						//Load the data from the query and do not set selected
						service = variantData.Service.startsWith("/") ? this.controller.serviceURL + variantData.Service :
							this.controller.serviceURL + "/" + variantData.Service;
						callPath = variantData.ServEntity;
						var pModel;
						pModel = new ODataModel(service, {
							json: true
						});
						var paramStr = this.createParamStr(variantData.Fields);
						if (paramStr === false) {
							return;
						}
						if (paramStr !== undefined) {
							callPath += "Parameters" + paramStr;
						}
						template = new sap.ui.core.ListItem({
							key: "{PeriodID}",
							text: "{PeriodShort}",
							additionalText: "{PeriodLong}"
						});

						fromCtrl.bindItems("/", template);
						fromCtrl.setModel(spModel);

						toCtrl.bindItems("/", template);
						toCtrl.setModel(spModel);
						var selectParams = "PeriodID,PeriodShort,PeriodLong";
						pModel.read("/" + callPath, {
							urlParameters: {
								$select: selectParams
							},
							success: $.proxy(function (oData) {
								var data = oData.results;
								spModel.setData(data);
								spModel.setSizeLimit(oData.results.length);
								// if (fromVal) {
								fromCtrl.setSelectedKey(fromVal);
								// }

								// if (toVal) {
								toCtrl.setSelectedKey(toVal);
								// }
							}, this),
							error: $.proxy(function (oErr) {
								// src.setBusy(false);
							}, this)
						});
					} else {
						fromCtrl.setEnabled(false);
						toCtrl.setEnabled(false);
						service = this.controller.serviceURL + "/BRS/Architect_DataModel/Query/FTM/services/CUR_PERIODS.xsodata";
						callPath = "/CUR_PERIODS";
						pModel = new ODataModel(service, {
							json: true
						});

						var filter = new sap.ui.model.Filter({
							path: "Type",
							operator: sap.ui.model.FilterOperator.EQ,
							value1: spValue
						});

						pModel.read(callPath, {
							filters: [filter],
							success: $.proxy(function (oData) {
								var res = oData.results[0];
								var fItem = new sap.ui.core.ListItem({
									key: res.FromPeriod,
									text: res.FromPeriodShort,
									additionalText: res.FromPeriodLong
								});
								fromCtrl.addItem(fItem);
								fromCtrl.setSelectedKey(res.FromPeriod);
								var tItem = new sap.ui.core.ListItem({
									key: res.ToPeriod,
									text: res.ToPeriodShort,
									additionalText: res.ToPeriodLong
								});
								toCtrl.addItem(tItem);
								toCtrl.setSelectedKey(res.ToPeriod);
							}, this),
							error: $.proxy(function (oErr) {
								jQuery.sap.log.error("cannot load period Data");
							}, this)
						});
					}
				}
				break;
			default:
			}
		},

		/*Special Filters*/
		loadSpecialFilters: function (src, controller, modelName) {
			var woStatusModel = controller.getView().getModel(modelName);
			src.setModel(woStatusModel);

			var template = new sap.ui.core.ListItem({
				key: "{key}",
				text: "{text}"
			});
			src.bindAggregation("items", {
				path: "/data",
				template: template
			});

			//Set the Status and Due Date values
			var fltrInfoData = src.data("fltrLoadInfo");
			var variantData = src.data("variantData");
			this.setSelectedSpecialValues(src, fltrInfoData, variantData, controller);
		},

		setSelectedSpecialValues: function (oControl, fltrInfoData, variantData, controller) {
			var dfArr = fltrInfoData.DefaultFilterVal;
			if (!dfArr) {
				return;
			}

			if (fltrInfoData && fltrInfoData.SelectionControl === "specialAssetDateRange") {
				var assetDateCtrl = oControl.getParent().getItems()[2];
				//set the value in defaultFilterVal to date control
				oControl.setSelectedKey("OverdueA");
				assetDateCtrl.setEnabled(false);
				assetDateCtrl.setDateValue(new Date());

				if (dfArr[0].val_low && dfArr[0].val_low.toLowerCase() !== "overduea") {
					var isValidDate = (dfArr[0].val_low && !isNaN(new Date(dfArr[0].val_low).getTime())) ? true : false;
					if (isValidDate === false) {
						//Clear both date fields
						oControl.setSelectedKey("Custom");
						assetDateCtrl.setEnabled(true);
						assetDateCtrl.setDateValue(null);
						assetDateCtrl.setSecondDateValue(null);
					} else if (isValidDate === true) {
						//Set the dates from JumpTo
						oControl.setSelectedKey("Custom");
						assetDateCtrl.setEnabled(true);
						assetDateCtrl.setDateValue(new Date(dfArr[0].val_low));
						assetDateCtrl.setSecondDateValue(new Date(dfArr[0].val_high));
					}
				}
			} else {

				var woStatusCtrl = oControl.getParent().getItems()[2].getItems()[1];
				/*bind the different statuses*/
				var statusM = controller.getView().getModel("woStatusCodeModel");
				woStatusCtrl.setModel(statusM);
				var template = new sap.ui.core.ListItem({
					key: "{key}",
					text: "{text}"
				});
				woStatusCtrl.bindAggregation("items", {
					path: "/data",
					template: template
				});

				var woDueDateCtrl = oControl.getParent().getItems()[2].getItems()[3];
				var selectedKey = dfArr[0].val_low;
				var defaultStatusKey = ["INPL", "PLND", "SCHD", "DISP", "ACKN", "REJT", "ONST", "MSAF", "HOLD", "INPR"];
				woStatusCtrl.setEnabled(false);
				woDueDateCtrl.setEnabled(false);
				switch (selectedKey) {
				case "OpenA":
					/*All open work orders*/
					woStatusCtrl.setSelectedKeys(defaultStatusKey);
					woDueDateCtrl.setValue("");
					break;
				case "OverdueA":
					woStatusCtrl.setSelectedKeys(defaultStatusKey);

					var currDate = new Date();
					woDueDateCtrl.setDateValue(currDate);
					// woDueDateCtrl.setSecondDateValue(currDate);
					break;
				case "Duenext24":
					woStatusCtrl.setSelectedKeys(defaultStatusKey);
					var date = new Date().setDate(new Date().getDate() + 1);
					woDueDateCtrl.setDateValue(new Date(date));
					// woDueDateCtrl.setSecondDateValue(new Date(date));
					break;
				case "Custom":
					woStatusCtrl.setEnabled(true);
					woDueDateCtrl.setEnabled(true);
					woDueDateCtrl.setValue("");
					break;
				case "None":
					woStatusCtrl.setEnabled(false);
					woDueDateCtrl.setEnabled(false);
					woDueDateCtrl.setValue("");
					woStatusCtrl.setSelectedKeys(null);
					break;
				default:
				}
			}
		},

		/*On Values bwing changed on Special Filters.*/
		onSpecialFiltersSelectionChange: function (oEvt, specialFilter, controller) {
			var selectedKey = oEvt.getParameter("selectedItem").getKey();
			var src = oEvt.getSource();
			var fltrInfoData = src.data("fltrLoadInfo");
			var variantData = src.data("variantData");
			fltrInfoData.DefaultFilterVal = [{
				"Filedname": fltrInfoData.Fieldname,
				"filter_op": "eq",
				"val_low": selectedKey
			}];
			if (specialFilter === "woStatus") {
				this.setSelectedSpecialValues(src, fltrInfoData, variantData, controller);
			} else if (specialFilter === "assetDate") {
				this.setSelectedSpecialValues(src, fltrInfoData, variantData, controller);
			} else {
				this.setSelectedValues(src, fltrInfoData, variantData);
			}
		},

		createParamStr: function (fieldArr) {
			var paramStr;
			/*Check for Parameters list and values in the paramter. can be only one value for parameter*/
			var paramsArr = fieldArr.filter(function (field) {
				if (field.hasOwnProperty("IsParameter") && field.IsParameter === "true") {
					return field;
				}
			}, this);

			for (var i = 0; i < paramsArr.length; i++) {
				var paramObj = paramsArr[i];
				if (paramObj.hasOwnProperty("Filter_Val") && paramObj.Filter_Val && paramObj.Filter_Val.length) {
					if (paramObj.Filter_Val.length === 0 || paramObj.Filter_Val >= 2) {
						MessageBox.alert(this.controller.oBundle.getProperty("fltrErr1"));
						return false;
					} else {
						if (paramStr) {
							paramStr += paramObj.Fieldname + "='" + paramObj.Filter_Val[0].val_low + "', ";
						} else {
							//First time
							paramStr = "(" + paramObj.Fieldname + "='" + paramObj.Filter_Val[0].val_low + "', ";
						}
					}
				} else {
					MessageBox.alert(this.controller.oBundle.getProperty("fltrErr2"));
					return false;
				}
			}

			/*Remove the last comma and close the braces*/
			paramStr = (paramStr !== undefined) ? paramStr.replace(/,\s*$/, "") + ")/Results" : undefined;
			return paramStr;
		},

		/*
		Function to create the Filter objects in the filter pane and apply it to the variant config.
		*/
		createFilterPaneFilters: function (oEvt) {
			this.controller.onVariantSettingBtnPressed(true);

			var filterArr = [];
			var newVariantModelData = this.controller.onVariantAction(oEvt, false);
			var tempArr = newVariantModelData.tempArr;
			if (tempArr === null) {
				jQuery.sap.log.error("Temp Field Array Null");
				return;
			}

			var form = this.controller.getView().byId("idBRSFilterPaneForm");
			//get all the important ComboBox Fields.
			if (form && form.getContent()) {
				var contentArr = form.getContent();
				contentArr.forEach(function (content) {
					var newFilter = [],
						fieldname, idx, dataF;
					var controlType = content.data("selectionControl");
					switch (controlType && controlType.toLowerCase()) {
					case "single":
					case "multi":
						dataF = content.getItems()[1];
						// if (dataF && (dataF instanceof sap.m.ComboBox || dataF instanceof sap.m.MultiComboBox || dataF instanceof sap.m.MultiInput)) {
						fieldname = dataF.data("fltrLoadInfo").Fieldname;
						//idx = newVariantModelData.tempArr.indexOf(fieldname);
						//	if (idx >= 0) {
						newFilter = FilterUtils.singleMultiFilters(content, controlType);
						// if (newVariantModelData.newVariantModelData.Fields[idx].Filter_Val && newVariantModelData.newVariantModelData.Fields[idx].Filter_Val
						// 	.length > 0) {
						// 	newFilter = newFilter.concat(newVariantModelData.newVariantModelData.Fields[idx].Filter_Val);
						// } 
						// else {
						//newVariantModelData.newVariantModelData.Fields[idx].Filter_Val = newFilter;
						if (newFilter && newFilter.length && newFilter.length > 0) {
							filterArr.push(newFilter);
						}
						// }
						// }
						break;

					case "range":
						dataF = content.getItems()[1];
						var items = dataF.getItems();
						var fromCtrl = items[1];
						fieldname = fromCtrl.data("fltrLoadInfo").Fieldname;
						// idx = newVariantModelData.tempArr.indexOf(fieldname);
						// if (idx >= 0) {
						newFilter = FilterUtils.rangeFilters(content);
						// newVariantModelData.newVariantModelData.Fields[idx].Filter_Val = newFilter;
						if (newFilter && newFilter.length && newFilter.length > 0) {
							filterArr.push(newFilter);
						}
						// }
						break;
					case "rangedate":
						dataF = content.getItems()[1];
						fieldname = dataF.data("fltrLoadInfo").Fieldname;
						// idx = newVariantModelData.tempArr.indexOf(fieldname);
						// if (idx >= 0) {
						newFilter = FilterUtils.rangeDateFilters(content);
						// newVariantModelData.newVariantModelData.Fields[idx].Filter_Val = newFilter;
						if (newFilter && newFilter.length && newFilter.length > 0) {
							filterArr.push(newFilter);
						}
						// }
						break;
					case "specialrange":
						dataF = content.getItems()[1];
						fieldname = dataF.data("fltrLoadInfo").Fieldname;
						// idx = newVariantModelData.tempArr.indexOf(fieldname);
						// if (idx >= 0) {
						newFilter = FilterUtils.specialRangeFilters(content);
						if (newFilter) {
							// newVariantModelData.newVariantModelData.Fields[idx].Filter_Val = newFilter;
							filterArr.push(newFilter);
						}
						// }
						break;
					case "rangenumber":
						dataF = content.getItems()[1];
						var fromRng = dataF.getItems()[1];
						fieldname = fromRng.data("fltrLoadInfo").Fieldname;
						// idx = newVariantModelData.tempArr.indexOf(fieldname);
						// if (idx >= 0) {
						newFilter = FilterUtils.numberRangeFilters(content);
						// newVariantModelData.newVariantModelData.Fields[idx].Filter_Val = newFilter;
						if (newFilter && newFilter.length && newFilter.length > 0) {
							filterArr.push(newFilter);
						}
						// }
						break;
						/*case "specialwostatus":
							dataF = content.getItems()[1];
							newFilter = FilterUtils.specialWOStatusFilters(content);
							var childVB = dataF.getParent().getItems()[2];
							var idxWoStatus = newVariantModelData.tempArr.indexOf("WorkOrderStatus");
							var idxWoDueDate = newVariantModelData.tempArr.indexOf("CustomerSLA2DueDate");

							var woStatusCtrl = childVB.getItems()[1];
							var woDueDateCtrl = childVB.getItems()[3];
							//Update Work Order Status Data
							if (idxWoStatus > -1 && woStatusCtrl instanceof sap.m.MultiComboBox) {
								var statusArr = [];
								statusArr = newFilter.filter(function (fObj) {
									return (fObj.Fieldname && fObj.Fieldname === "WorkOrderStatus");
								}, this);
								newVariantModelData.newVariantModelData.Fields[idxWoStatus].Filter_Val = statusArr;
							}

							//Update Work order Due Date Data
							if (idxWoDueDate > -1 && woDueDateCtrl instanceof sap.m.DateRangeSelection) {
								var dueDateFilterArr = [];
								dueDateFilterArr = newFilter.filter(function (fObj) {
									return (fObj.Fieldname && fObj.Fieldname === "CustomerSLA2DueDate");
								}, this);
								newVariantModelData.newVariantModelData.Fields[idxWoDueDate].Filter_Val = dueDateFilterArr;
							}
							break;
						case "specialassetdaterange":
							dataF = content.getItems()[1];
							fieldname = dataF.data("fltrLoadInfo").Fieldname;
							idx = newVariantModelData.tempArr.indexOf(fieldname);
							if (idx >= 0) {
								newFilter = FilterUtils.specialAssetDateFilters(content);
								newVariantModelData.newVariantModelData.Fields[idx].Filter_Val = newFilter;
							}
							break;*/
					default:
					}
				}, this);

				//No Concept of saving the variant. Return the filters and appply to the OData Call

				return filterArr;
			} else {
				this.controller.getView().setBusy(false);
				jQuery.sap.log.error("Error in ChartMaster. form element not found for saving");
			}
		},

		setAdvancedFilterCount: function (controller, advFLayout, variantData) {
			var advFilL = controller.getView().byId(advFLayout);
			/*calculate the number of Advanced Filters*/
			if (!variantData || !variantData.FilterPanel) {
				return;
			}
			var vFields = variantData.Fields.filter(function (obj) {
				if (obj.Filter_Val && obj.Filter_Val.length && obj.Filter_Val.length > 0) {
					return obj;
				}
			}, this);
			if (variantData.FilterPanel) {
				var fFields = variantData.FilterPanel.Fields;
				var advFilCnt = this.calculateAdvancedFilterCount(vFields, fFields);
				var str;
				if (advFilCnt > 9) {
					str = "9+";
				} else {
					str = advFilCnt + "";
				}
				advFilL.getItems()[1].setText(str);
				advFilL.attachBrowserEvent("click", function (oEvt) {
					/*Load the variant screen*/
					controller.onVariantSettingBtnPressed();
				}, controller);
			}

		},

		calculateAdvancedFilterCount: function (a1, a2) {
			var count = 0;
			a2.forEach(function (obj1) {
				a1.forEach(function (obj2) {
					if (obj1.Fieldname === obj2.Fieldname) {
						count++;
					}
				}, this);
			}, this);

			return a1.length - count;
		}
	};
});