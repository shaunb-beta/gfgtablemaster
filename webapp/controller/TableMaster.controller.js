sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageBox",
	"sap/ui/model/json/JSONModel",
	"brs_demo_tablemaster/FilterPane/FilterPane",
	"brs_demo_tablemaster/controller/DetailView",
	"brs_demo_tablemaster/utilities/Utilities",
	"brs_demo_tablemaster/controller/ActionClass",
	"brs_demo_tablemaster/utilities/Controls"
], function (Controller, MessageBox, JSONModel, FilterPane, DetailView, Utilities, ActionClass, Controls) {
	"use strict";

	return Controller.extend("brs_demo_tablemaster.controller.TableMaster", {
		basePath: "/BluView",
		onInit: function () {
			/*Busy Indicator might be active bacause of cross-app navigation*/
			sap.ui.core.BusyIndicator.hide();

			this.getView().setBusyIndicatorDelay(0);
			this.getView().setBusy(true);
			this.component = this.getOwnerComponent();
			this.serviceURL = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/HANA/uri");
			this.sapServiceURL = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/SAPGateway/uri");
			this.modulePath = jQuery.sap.getModulePath("brs_demo_tablemaster");
			this.oBundle = this.component.getModel("i18n");
			var destModel = this.component.getModel("destModel");
			if (destModel && destModel.getProperty("/ezycommercedest")) {
				this.serviceURL = "/" + destModel.getProperty("/ezycommercedest");
			} else {
				this.getView().setBusy(false);
				MessageBox.alert("No Destination configuration found. Please try again later");
				return;
			}
			this.allDataFlag = undefined;
			this.filters = undefined;
			this.filterApplied = undefined;
			this.oInitialLoadMessage = this.getView().byId("idInitialLoadMessageStrip");

			/*#FilterPane - Register Click event for Filter Pane*/
			this.getView().byId("idBRSFilterToggleL").attachBrowserEvent("click", this.toggleFilterPane, this);
			/***********End**********/

			Utilities.initUtilities(this);
			//Load the table data based on the parent navigation Target
			if (sap.ushell) {
				this.getComponentData();
			} else {
				this.loadVariantData("OrderStat");
			}
		},

		getComponentData: function () {
			var componentData = this.component.getComponentData();
			if (componentData && componentData.startupParameters) {
				//Set the header
				var header = componentData.startupParameters.hasOwnProperty("title") ? componentData.startupParameters.title[0] : "";
				this.getView().byId("idAppHeader").setText(unescape(header));

				/*get the appId*/
				var appId = componentData.startupParameters.hasOwnProperty("appId") ? componentData.startupParameters.appId[0] : undefined;
				var appVariantId = componentData.startupParameters.hasOwnProperty("appVariantId") ? componentData.startupParameters.appVariantId[0] :
					undefined;
				var isuv = componentData.startupParameters.hasOwnProperty("uv") ? componentData.startupParameters.uv[0] :
					undefined;
				var jumpToID = componentData.startupParameters.hasOwnProperty("jtID") ? componentData.startupParameters.jtID[0] : undefined;
				if (jumpToID) {
					this.loadJumptoFilterData(appId, appVariantId, isuv, jumpToID);
				} else if (appId) {
					this.loadVariantData(appId, appVariantId, isuv);
				} else {
					MessageBox.alert(this.oBundle.getProperty("appError"));
				}
			}
		},

		/*Get Jump To Filters from previous/source app */
		loadJumptoFilterData: function (appId, appVariantId, isuv, jumpToID) {
			var url = this.serviceURL +
				"/BRS/HAA/services/SessionParameters.xsodata/SessionParameters?$format=json&$filter=Paramname eq 'jumpTo'";
			$.ajax({
				url: url,
				type: "GET",
				context: this,
				contentType: "application/json",
				success: function (oData) {
					this.jumpToData = oData.d.results[0].Value || oData.results[0].Value;
					if (this.jumpToData && JSON.parse(this.jumpToData).key && JSON.parse(this.jumpToData).key === jumpToID) {
						this.jumpTo = true;
						this.jumpToData = JSON.parse(this.jumpToData).value;
					}
					this.loadVariantData(appId, appVariantId, isuv);
				},
				error: function (oErr) {
					this.jumpTo = undefined;
					jQuery.sap.log.error("Filter Panel Data not passed");
					this.loadVariantData(appId, appVariantId, isuv);
				}
			});
		},

		loadVariantData: function (appId, appVariantId, isuv /*App_ID and APPVariant_ID passed from higher level applications if available*/ ) {
			var selectedVariantGrp;
			this.cleanUp();
			var vGrpSel = this.getView().byId("idBRSTableMasterVarintGrpSelect");

			var varGrpModel = new sap.ui.model.json.JSONModel(this.serviceURL + this.basePath + "/HAA/services/AppConfig.xsodata/Application");
			varGrpModel.attachRequestCompleted(function (oEvt) {
				this.getView().setModel(varGrpModel, "variantGroupModel");
				if (appId) {
					selectedVariantGrp = appId;
				} else {
					selectedVariantGrp = oEvt.getSource().getData().d.results[0].AppID;
				}

				vGrpSel.setSelectedKey(selectedVariantGrp);
				var selList = vGrpSel.getList();
				Utilities.addCustomStyleClass(selList, "tableMasterSelectList");
				this.getVariantConfig(selectedVariantGrp, appVariantId, isuv);
			}, this);
			varGrpModel.attachRequestFailed(function (oErr) {
				// this.getView().setBusy(false);
				// MessageBox.alert(this.oBundle.getProperty("err_gen"));
			}, this);
		},

		getVariantConfig: function (APP_ID, appVariantID, isuv) {
			/*get the variant config for the variant
			Load up the appropriate table based on the service Type
			Call the appropriate controller to build up the table.
			 */
			// this.getAppTypeToNavigate(APP_ID);
			this.cleanUp();
			var varSel = this.getView().byId("idBRSTableMasterVariantSelect");
			var selList = varSel.getList();
			Utilities.addCustomStyleClass(selList, "tableMasterSelectList");
			var variantModel = new sap.ui.model.json.JSONModel();
			this.getView().setModel(variantModel, "variantModel");
			var selectedVariant;
			isuv = (isuv === undefined) ? "App" : isuv;
			$.ajax({
				url: this.serviceURL + this.basePath + "/HAA/services/GetConfig.xsjs?AppID=" + APP_ID,
				type: "GET",
				context: this,
				contentType: "application/json",
				success: function (configData) {
					var variantData = configData.results.Variants;
					variantData = variantData.filter(function (variant) {
						return variant.AppVariantType && (variant.AppVariantType.toLowerCase() === "standard" || variant.AppVariantType.toLowerCase() ===
							"standard_updt" ||
							variant.AppVariantType.toLowerCase() === "verticaltable" ||
							variant.AppVariantType.toLowerCase() ===
							"sptable_period" || variant.AppVariantType.toLowerCase() ===
							"sptable_period_flex" || variant.AppVariantType.toLowerCase() === "sptable_lcomm_month" || variant.AppVariantType.toLowerCase() ===
							"sptable_lcomm_year" || variant.AppVariantType.toLowerCase() === "spltable_rff");
					});
					if (variantData && variantData.length && variantData.length > 0) {
						Utilities.sortVariantList(variantData);

						variantModel.setData(variantData);
						variantModel.refresh(true);
						var currVariant,
							vType = (isuv && isuv.toLowerCase() === "app" ? "AppVariantID" : "UsrVariantID");
						if (appVariantID) {
							//use filter function for IE and Edge as "find" is not supported yet.
							if (sap.ui.Device.browser.msie || sap.ui.Device.browser.edge) {
								currVariant = variantData.filter(function (varObj) {
									if (varObj[vType] === appVariantID && varObj.Type.toLowerCase() === isuv.toLowerCase()) {
										return varObj;
									}
								}, this);
								if (currVariant && currVariant.length > 0) {
									currVariant = currVariant[0];
								}
							} else {
								currVariant = variantData.find(function (varObj) {
									if (varObj[vType] === appVariantID && varObj.Type.toLowerCase() === isuv.toLowerCase()) {
										return varObj;
									}
								}, this);
							}

						}

						if (!currVariant) {
							currVariant = variantModel.getData()[0];
						}
						if (currVariant.Type === "App") {
							selectedVariant = currVariant.AppVariantID;
						} else if (currVariant.Type === "User" && currVariant.Username === "_#SUPER") {
							selectedVariant = currVariant.AppVariantID + " " + currVariant.UsrVariantID + " " + currVariant.Username;
						} else {
							selectedVariant = currVariant.AppVariantID + " " + currVariant.UsrVariantID;
						}

						varSel.setSelectedKey(selectedVariant);
						jQuery.sap.delayedCall(10, this, function () {
							if (currVariant.AppVariantType.toLowerCase() === "sptable_lcomm_month" || currVariant.AppVariantType.toLowerCase() ===
								"sptable_lcomm_year") {
								this._bCallMergeForlm = true;
							}
							this.getTableConfig(selectedVariant, undefined, true);
						}, [selectedVariant]);
					} else {
						this.getView().setBusy(false);
					}

				},
				error: function (oErrMessage) {
					variantModel.setData();
					sap.m.MessageBox.alert(this.oBundle.getProperty("err_gen"));
				}
			});
		},

		displayMandatoryFilterMessage: function () {
			this.intialLoadMessageDisplayed = true;
			var intialLoadBox = this.getView().byId("idInitialLoadVB");
			if (intialLoadBox) {
				sap.ui.core.BusyIndicator.hide();
				this.getView().setBusy(false);
				this.getView().byId("idBRSTableMasterVariantReponsiveDataTableHeader").setVisible(false);
				this.getView().byId("idBRSTableMasterVariantReponsiveDataTable").setVisible(false);
				intialLoadBox.setVisible(true);
			}
		},

		onVariantGroupChanged: function (oEvt) {
			var selectedVGrpID = oEvt.getParameter("selectedItem").getKey();
			this.getVariantConfig(selectedVGrpID);
		},

		onVariantChanged: function (oEvt) {
			this.allDataFlag = undefined;
			this.intialLoadMessageDisplayed = undefined;
			var select = oEvt.getSource(),
				variantData = select.getSelectedItem().data("variantData");
			if (variantData && (variantData.AppVariantType === "sptable_lcomm_month" || variantData.AppVariantType === "sptable_lcomm_year")) {
				this._bCallMergeForlm = true;
			}
			this.getTableConfig(oEvt, true, true);
		},

		getTableConfig: function (oEvt, bLoadFilterUI, bInit) {
			var select, variantData;
			/*Cleanup the already existing Table*/
			this.cleanUp();
			/*triggered on change of Selection */
			if (oEvt instanceof Object) {
				select = oEvt.getSource();
				variantData = select.getSelectedItem().data("variantData");
			} else {
				select = this.getView().byId("idBRSTableMasterVariantSelect");
				select.setSelectedKey(oEvt);
				variantData = select.getSelectedItem() ? select.getSelectedItem().data("variantData") : null;
			}

			this.variantData = variantData;

			/*Check if variant is an update variant*/
			if (variantData && variantData.AppVariantType && variantData.AppVariantType.toLowerCase() === "standard_updt") {
				this.getView().byId("idSaveData").setVisible(true);
			} else {
				this.getView().byId("idSaveData").setVisible(false);
			}

			/*#FilterPane*/
			if (bLoadFilterUI !== false) {
				FilterPane.loadFilterUI(variantData, this);
			} else {
				FilterPane.setAdvancedFilterCount(this, "idBRSFilterPaneAdvL", variantData);
			}

			/*Check if a special range filter is added in*/
			// var specialFilterAdded = Utilities.checkSpecialRangeFilter(variantData);
			if ((this.jumpTo && variantData && bInit === true) || (this._bCallMergeForlm && variantData && variantData.AppVariantType && (
					variantData
					.AppVariantType ===
					"sptable_lcomm_month" || variantData.AppVariantType === "sptable_lcomm_year"))) {
				/*!!!!!NOTE: Check if you have FilterPane Filters. Also there are mandatory intial fixed period filters for lease commitments reports*/
				Utilities.mergeJTFPVarfilters(variantData);
			} else if (!this.jumpTo && !this.intialLoadMessageDisplayed && variantData.InitialDataLoadFlag && variantData.InitialDataLoadFlag.toLowerCase() ===
				"false") {
				//Check for initial Load Flag
				this.displayMandatoryFilterMessage();
				return;
			}
			/*else if (bInit === true && specialFilterAdded === true) {
				Utilities.mergeJTFPVarfilters(variantData);
			}*/
			else {
				this.setTableConfig(variantData, bInit);
			}
		},

		/*
		#FilterPane - Filter Pane Functions.
		@relatesto: /webapp/controller/FilterPane.js
		*/
		/*Factory function to create the Filter Pane UI*/
		filterPaneCreateUI: function (sId, oContext) {
			var cmbBxS, rangeVB, bLoadInit = false;
			var UIControl = new sap.m.VBox({
				width: "100%",
				fitContainer: true,
				items: [
					new sap.m.Label({
						text: oContext.getProperty("FieldDescription") ? oContext.getProperty("FieldDescription").toUpperCase() : ""
					}).addStyleClass("sapUiSmallMarginTop brsFilterPaneLabelColor")
				]
			});
			UIControl.setLayoutData(new sap.ui.layout.GridData({
				span: "XL4 L4 M6 S12"
			}));

			var controlType = oContext.getProperty("SelectionControl");
			var customData = new sap.ui.core.CustomData({
				key: "fltrLoadInfo",
				value: oContext.getObject(oContext.sPath)
			});

			var select = this.getView().byId("idBRSTableMasterVariantSelect");
			var variantData = select.getSelectedItem() ? select.getSelectedItem().data("variantData") : null;
			var varCustomData = new sap.ui.core.CustomData({
				"key": "variantData",
				"value": variantData
			});
			var controlTypeCustomData = new sap.ui.core.CustomData({
				"key": "selectionControl",
				"value": controlType
			});
			UIControl.addCustomData(controlTypeCustomData);
			var field;
			//replace with filter for IE and edge
			if (sap.ui.Device.browser.msie || sap.ui.Device.browser.edge) {
				field = variantData.Fields.filter(function (fieldData) {
					if (fieldData.Fieldname === oContext.getProperty("Fieldname")) {
						return fieldData;
					}
				}, this);
				if (field && field.length > 0) {
					field = field[0];
				}
			} else {
				field = variantData.Fields.find(function (fieldData) {
					if (fieldData.Fieldname === oContext.getProperty("Fieldname")) {
						return fieldData;
					}
				}, this);
			}

			/*set bInit to true if default Filter needed to be set and applied on the initial Load*/
			if (field && field.Filter_Val && field.Filter_Val.length && field.Filter_Val.length > 0) {
				oContext.getObject(oContext.sPath).DefaultFilterVal = field.Filter_Val;
				bLoadInit = true;
			}

			var jtVal, fieldname = oContext.getProperty("Fieldname");

			switch (controlType && controlType.toLowerCase()) {
			case "single":
			case "multi":
				var dialog = oContext.getProperty("Dialog");
				if (this.jumpTo) {
					jtVal = this.jumpToData.filter(function (jumpObj) {
						return jumpObj.Fieldname === fieldname;
					}, this);
				}

				if (jtVal && jtVal.length && jtVal.length > 0) {
					customData.getValue().DefaultFilterVal = jtVal;
					bLoadInit = true;
				}

				if (dialog && dialog.toLowerCase() === "true") {
					/*Dialog Input*/
					var inputS = new sap.m.MultiInput({
						enableMultiLineMode: false,
						placeholder: "Select " + oContext.getProperty("FieldDescription"),
						showValueHelp: true,
						valueHelpOnly: true
					});

					inputS.attachValueHelpRequest(function (oEvt) {
						var fltrInfo = oEvt.getSource().data("fltrLoadInfo");
						var multiSelect = (fltrInfo.SelectionControl && fltrInfo.SelectionControl === "Single") ? false : true;
						FilterPane.loadFPDialogData(oEvt.getSource(), this, multiSelect);
					}, this);
					inputS.addCustomData(customData);
					inputS.addCustomData(varCustomData);
					UIControl.addItem(inputS);

				} else if (controlType.toLowerCase() === "single") {
					/*Single Select ComboBox*/
					cmbBxS = new sap.m.ComboBox({
						width: "100%",
						showSecondaryValues: true
					});
					cmbBxS.attachLoadItems(function (oEvt) {
						FilterPane.loadFFData(oEvt.getSource());
					}, this);
					cmbBxS.addCustomData(customData);
					cmbBxS.addCustomData(varCustomData);
					UIControl.addItem(cmbBxS);
				} else {
					/*Multi Select ComboBox*/
					cmbBxS = new sap.m.MultiComboBox({
						showSecondaryValues: true
					});
					cmbBxS.onBeforeRenderingPicker = function (oEvt) {
						var picker = this.getPicker();
						var list = picker.getContent()[0];
						if (list && list instanceof sap.m.List) {
							list.setShowNoData(false);
						}
						jQuery.sap.delayedCall(10, this, function () {
							if (sap.m.MultiComboBox.prototype.onBeforeRenderingPicker) {
								sap.m.MultiComboBox.prototype.onBeforeRenderingPicker.apply(this, arguments);
							}
							FilterPane.loadFFData(this, undefined);
						}, [picker]);
					};
					cmbBxS.addCustomData(customData);
					cmbBxS.addCustomData(varCustomData);
					UIControl.addItem(cmbBxS);
				}
				break;

			case "range":
				if (this.jumpTo) {
					jtVal = this.jumpToData.filter(function (jumpObj) {
						return jumpObj.Fieldname === fieldname;
					}, this);
				}

				if (jtVal && jtVal.length && jtVal.length > 0) {
					customData.getValue().DefaultFilterVal = jtVal;
					bLoadInit = true;
				}
				/*Create from and to*/
				rangeVB = new sap.m.VBox({
					width: "100%",
					fitContainer: true
				});
				UIControl.addItem(rangeVB);

				var fromLabel = new sap.m.Label({
					text: "{i18n>from}"
				}).addStyleClass("brsFilterPaneLabelColor");
				var frmCmbBxSR = new sap.m.ComboBox({
					width: "100%",
					customData: [new sap.ui.core.CustomData({
							key: "fltrLoadInfo",
							value: oContext.getObject(oContext.sPath)
						}),
						new sap.ui.core.CustomData({
							"key": "variantData",
							"value": variantData
						})
					]
				});
				frmCmbBxSR.attachLoadItems(function (oEvt) {
					FilterPane.loadFFData(oEvt.getSource());
				}, this);

				var toLabel = new sap.m.Label({
					text: "{i18n>to}"
				}).addStyleClass("brsFilterPaneLabelColor");
				var toCmbBxSR = new sap.m.ComboBox({
					width: "100%",
					customData: [new sap.ui.core.CustomData({
							key: "fltrLoadInfo",
							value: oContext.getObject(oContext.sPath)
						}),
						new sap.ui.core.CustomData({
							"key": "variantData",
							"value": variantData
						})
					]
				});
				toCmbBxSR.attachLoadItems(function (oEvt) {
					FilterPane.loadFFData(oEvt.getSource());
				}, this);
				rangeVB.addItem(fromLabel).addItem(frmCmbBxSR).addItem(toLabel).addItem(toCmbBxSR);
				break;

			case "rangenumber":
				if (this.jumpTo) {
					jtVal = this.jumpToData.filter(function (jumpObj) {
						return jumpObj.Fieldname === fieldname;
					}, this);
				}

				if (jtVal && jtVal.length && jtVal.length > 0) {
					customData.getValue().DefaultFilterVal = jtVal;
					bLoadInit = true;
				}
				/*Create from and to*/
				rangeVB = new sap.m.VBox({
					width: "100%",
					fitContainer: true
				});
				UIControl.addItem(rangeVB);

				var fromLabelNum = new sap.m.Label({
					text: "{i18n>from}"
				}).addStyleClass("brsFilterPaneLabelColor");
				var frmInp = new sap.m.Input({
					placeholder: this.oBundle.getProperty("numFieldPH"),
					type: sap.m.InputType.Number,
					width: "100%",
					customData: [new sap.ui.core.CustomData({
							key: "fltrLoadInfo",
							value: oContext.getObject(oContext.sPath)
						}),
						new sap.ui.core.CustomData({
							"key": "variantData",
							"value": variantData
						})
					]
				});

				var toLabelNum = new sap.m.Label({
					text: "{i18n>to}"
				}).addStyleClass("brsFilterPaneLabelColor");
				var toInp = new sap.m.Input({
					placeholder: this.oBundle.getProperty("numFieldPH"),
					type: sap.m.InputType.Number,
					width: "100%",
					customData: [new sap.ui.core.CustomData({
							key: "fltrLoadInfo",
							value: oContext.getObject(oContext.sPath)
						}),
						new sap.ui.core.CustomData({
							"key": "variantData",
							"value": variantData
						})
					]
				});
				rangeVB.addItem(fromLabelNum).addItem(frmInp).addItem(toLabelNum).addItem(toInp);
				break;
			case "rangedate":
				if (this.jumpTo) {
					jtVal = this.jumpToData.filter(function (jumpObj) {
						return jumpObj.Fieldname === fieldname;
					}, this);
				}

				if (jtVal && jtVal.length && jtVal.length > 0) {
					customData.getValue().DefaultFilterVal = jtVal;
					bLoadInit = true;
				}

				var dtRange = new sap.m.DateRangeSelection({
					delimiter: " to "
				});
				dtRange.addCustomData(customData);
				dtRange.addCustomData(varCustomData);
				UIControl.addItem(dtRange);
				break;

			case "specialrange":
				/*NOTE: will only work for periods*/
				/*Check JumpTo data for Period ID*/
				if (this.jumpTo) {
					//replace with filter for IE and edge
					if (sap.ui.Device.browser.msie || sap.ui.Device.browser.edge) {
						jtVal = this.jumpToData.filter(function (jumpObj) {
							return jumpObj.Fieldname === fieldname;
						}, this);
						if (jtVal && jtVal.length > 0) {
							jtVal = jtVal[0];
						}
					} else {
						jtVal = this.jumpToData.find(function (jumpObj) {
							return jumpObj.Fieldname === fieldname;
						}, this);
					}
				}

				if (jtVal) {
					customData.getValue().DefaultFilterVal = [{
						Fieldname: fieldname,
						filter_op: "eq",
						val_low: "Custom"
					}];
				}
				bLoadInit = true;

				/*Special case..Display 3 boxes with values*/
				cmbBxS = new sap.m.ComboBox({
					width: "100%",
					showSecondaryValues: true
				});
				cmbBxS.attachLoadItems(function (oEvt) {
					FilterPane.loadFFData(oEvt.getSource(), undefined, undefined, "specialFilter");
					// FilterPane.loadSpecialFilters(oEvt.getSource());
				}, this);
				cmbBxS.attachSelectionChange(function (oEvt) {
					FilterPane.onSpecialFiltersSelectionChange(oEvt);
				}, this);
				cmbBxS.addCustomData(customData);
				cmbBxS.addCustomData(varCustomData);
				UIControl.addItem(cmbBxS);

				/*create controls for ranges*/
				rangeVB = new sap.m.VBox({
					width: "100%",
					fitContainer: true
				});
				UIControl.addItem(rangeVB);

				var fromLbl = new sap.m.Label({
					text: "{i18n>from}"
				}).addStyleClass("brsFilterPaneLabelColor");
				var frmRange = new sap.m.ComboBox({
					width: "100%",
					enabled: false,
					showSecondaryValues: true,
					customData: new sap.ui.core.CustomData({
						key: "splFieldKey",
						value: "from"
					})
				});
				var toLbl = new sap.m.Label({
					text: "{i18n>to}"
				}).addStyleClass("brsFilterPaneLabelColor");
				var toRange = new sap.m.ComboBox({
					width: "100%",
					enabled: false,
					showSecondaryValues: true
				});
				rangeVB.addItem(fromLbl).addItem(frmRange).addItem(toLbl).addItem(toRange);
				break;
				/*special Filter for Work Order Apps*/
			case "specialwostatus":
				if (this.jumpTo) {
					//replace with filter for IE and edge
					if (sap.ui.Device.browser.msie || sap.ui.Device.browser.edge) {
						jtVal = this.jumpToData.filter(function (jumpObj) {
							return jumpObj.Fieldname === fieldname;
						}, this);
						if (jtVal && jtVal.length > 0) {
							jtVal = jtVal[0];
						}
					} else {
						jtVal = this.jumpToData.find(function (jumpObj) {
							return jumpObj.Fieldname === fieldname;
						}, this);
					}
				}

				if (jtVal) {
					customData.getValue().DefaultFilterVal = [{
						Fieldname: fieldname,
						filter_op: "eq",
						val_low: jtVal.val_low
					}];
				}
				bLoadInit = true;

				/*Special case..Display 3 boxes with values*/
				cmbBxS = new sap.m.ComboBox({
					width: "100%"
				});
				cmbBxS.attachSelectionChange(function (oEvt) {
					FilterPane.onSpecialFiltersSelectionChange(oEvt, "woStatus", this);
				}, this);
				cmbBxS.addCustomData(customData);
				cmbBxS.addCustomData(varCustomData);
				UIControl.addItem(cmbBxS);

				/*create controls for ranges*/
				var childVB = new sap.m.VBox({
					width: "100%",
					fitContainer: true
				});
				UIControl.addItem(childVB);

				var woStatusLbl = new sap.m.Label({
					text: "{i18n>woStatus}"
				}).addStyleClass("brsFilterPaneLabelColor");
				var woStatusCtrl = new sap.m.MultiComboBox({
					enabled: false,
					customData: new sap.ui.core.CustomData({
						key: "splFieldWO",
						value: "Status"
					})
				});
				var woDueDataLbl = new sap.m.Label({
					text: "{i18n>woDueDate}"
				}).addStyleClass("brsFilterPaneLabelColor");
				var woDueDateCtrl = new sap.m.DateRangeSelection({
					enabled: false,
					delimiter: " to ",
					customData: new sap.ui.core.CustomData({
						key: "splFieldWO",
						value: "Status"
					})
				});
				childVB.addItem(woStatusLbl).addItem(woStatusCtrl).addItem(woDueDataLbl).addItem(woDueDateCtrl);
				FilterPane.loadSpecialFilters(cmbBxS, this, "woStatusData");
				break;
			case "specialassetdaterange":
				if (this.jumpTo) {
					//replace with filter for IE and edge
					if (sap.ui.Device.browser.msie || sap.ui.Device.browser.edge) {
						jtVal = this.jumpToData.filter(function (jumpObj) {
							return jumpObj.Fieldname === fieldname;
						}, this);
						if (jtVal && jtVal.length > 0) {
							jtVal = jtVal[0];
						}
					} else {
						jtVal = this.jumpToData.find(function (jumpObj) {
							return jumpObj.Fieldname === fieldname;
						}, this);
					}

				}

				if (jtVal) {
					customData.getValue().DefaultFilterVal = jtVal;
				}
				bLoadInit = true;

				/*Special case..Display 3 boxes with values*/
				cmbBxS = new sap.m.ComboBox({
					width: "100%"
				});
				cmbBxS.attachSelectionChange(function (oEvt) {
					FilterPane.onSpecialFiltersSelectionChange(oEvt, "assetDate", this);
				}, this);
				cmbBxS.addCustomData(customData);
				cmbBxS.addCustomData(varCustomData);
				UIControl.addItem(cmbBxS);

				var assetDueDateCtrl = new sap.m.DateRangeSelection({
					enabled: false,
					delimiter: " to ",
					customData: new sap.ui.core.CustomData({
						key: "splFieldAsset",
						value: "Date"
					})
				});
				UIControl.addItem(assetDueDateCtrl);
				FilterPane.loadSpecialFilters(cmbBxS, this, "assetDateData");
				break;
			default:
				UIControl = new sap.m.VBox();
				//Hardcoded
				jQuery.sap.log.error("SelectionControl not defined for Field: " + oContext.getProperty("FieldDescription") || oContext.getProperty(
					"Fieldname"));
			}

			/*Check if Data needs to be loaded initially*/
			if (bLoadInit) {
				FilterPane.setInitialFilters(UIControl, this);
			}
			return UIControl;
		},

		/*#FilterPane
		- Function to apply the Filter pane Filters
		*/
		applyFilterPane: function (oEvt) {
			this.jumpTo = undefined;
			// sap.ui.core.BusyIndicator.show(0);
			// var filterData = FilterPane.createFilterPaneFilters(oEvt);
			// if(filterData && filterData.length && filterData.length > 0){
			// 	this.filters = filterData;
			// }else{
			// 	this.filters = undefined;
			// }
			this.filterApplied = true;
			this.setTableConfig(this.variantData, true);
		},

		setTableConfig: function (variantData, bInit) {
			this.getView().setBusy(false);
			/*Initially just display a message. Data to be shown only when filter is applied*/
			if (!this.filterApplied && this.oInitialLoadMessage) {
				this.oInitialLoadMessage.setVisible(true);
				//Hide the table
				this.getView().byId("idBRSTableMasterToolbar").setVisible(false);
				this.getView().byId("idBRSTableMasterVariantReponsiveDataTable").setVisible(false);
				return;
			}

			this.oInitialLoadMessage.setVisible(false);
			var isxsjs = false,
				data;
			var responsiveTable = this.getView().byId("idBRSTableMasterVariantReponsiveDataTable");
			responsiveTable.setNoDataText(this.oBundle.getProperty("loadingIndicator"));
			responsiveTable.setVisible(true);
			this.getView().byId("idBRSTableMasterToolbar").setVisible(true);
			responsiveTable.setBusyIndicatorDelay(0);
			responsiveTable.setBusy(true);

			var userStr = "";
			if (variantData.Type !== "App") {
				if (variantData.Username === "_#SUPER") {
					userStr = "&UserVariant=" + variantData.UsrVariantID + "&IsSuper='true'";
				} else {
					userStr = "&Username=" + variantData.Username + "&UserVariant=" + variantData.UsrVariantID;
				}
			}

			//check All Data Flag;
			var allDataFlag;
			if (this.allDataFlag && this.allDataFlag === true) {
				allDataFlag = "alldataflag";
			} else {
				allDataFlag = "";
			}

			if (this.dataCall) {
				this.dataCall.abort();
			}

			var service = variantData.Service && variantData.Service.startsWith("/") ? variantData.Service : "/" + variantData.Service;
			var servEntity = variantData.ServEntity && variantData.ServEntity.startsWith("/") ? variantData.ServEntity : "/" + variantData.ServEntity;
			var url = this.serviceURL + service + servEntity;

			if (!service && !servEntity) {
				sap.m.MessageBox.alert("Incorrect config. Please check app configuration again");
			}

			if (!isxsjs) {
				this.setTable(variantData, data, responsiveTable, false);
			} else {

				this.getXSJSData(
					url,
					$.proxy(function (retData) {
						this.dataCall = undefined;
						data = retData.myResult;
						if (retData.d && retData.d.results) {
							data.data = retData.d.results;
						}
						if (!variantData) {
							responsiveTable.setBusy(false);
							responsiveTable.setNoDataText(this.oBundle.getProperty("noData"));
							return;
						}

						responsiveTable.setVisible(true);
						responsiveTable.setMode(sap.m.ListMode.SingleSelectMaster);
						responsiveTable.setIncludeItemInSelection(true);
						this.setTable(variantData, data, responsiveTable, isxsjs, data._queryInfo);
						this.getView().byId("idBRSTableVariantSettingsBtn").setVisible(true);
					}, this),
					$.proxy(function (oErr) {
						this.dataCall = undefined;
						if (oErr.status === 0) {
							if (oErr.statusText && oErr.statusText.toLowerCase() && oErr.statusText.toLowerCase() === "abort") {
								return;
							}
						}
						responsiveTable.setNoDataText(this.oBundle.getProperty("noData"));
						responsiveTable.setBusy(false);
						sap.m.MessageBox.alert(this.oBundle.getProperty("dataErr") + "\n" + oErr.responseText);
					}, this));
			}
		},

		getXSJSData: function (sURL, successCallback, errCallback) {

			this.dataCall = $.ajax({
				url: sURL,
				type: "GET",
				context: this,
				dataType: "json",
				contentType: "application/json",
				success: successCallback,
				error: errCallback
			});
		},

		setTable: function (variantData, data, gridTable, fromXSJS, _queryInfo) {
			this._sptableFormattingCalled = false;
			var tableDataModel, fields, paramStr,
				bindObject,
				sortArr = [],
				params = {
					selectParams: "",
					sortedArr: []
				},
				dataPath = "",
				headerTable = this.getView().byId("idBRSTableMasterVariantReponsiveDataTableHeader");
			// gridTable = this.getView().byId("idBRSTableMasterVariantReponsiveDataTable");

			/*Clear if any previous Tables*/
			this.cleanUp();

			if (fromXSJS === true) {
				tableDataModel = new sap.ui.model.json.JSONModel();
				tableDataModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay);
				tableDataModel.setData(data.data);
				fields = data._metadata && data._metadata.Fields ? data._metadata.Fields : variantData.Fields;
			} else {
				var service = variantData.Service && variantData.Service.startsWith("/") ? variantData.Service : "/" + variantData.Service;
				dataPath = variantData.ServEntity && variantData.ServEntity.startsWith("/") ? variantData.ServEntity : "/" + variantData.ServEntity;

				fields = (data && data._metadata && data._metadata.Fields) ? data._metadata.Fields : variantData.Fields;
				var modelObj = {
					json: true,
					defaultCountMode: sap.ui.model.odata.CountMode.None
				};

				tableDataModel = new sap.ui.model.odata.ODataModel(this.serviceURL + service, modelObj);
				tableDataModel.attachMetadataLoaded(function (oMetadata) {
					console.log("Metadata loaded");
				});
				tableDataModel.attachMetadataFailed(function (oMetadata) {
					console.log("Metadata Load Failed");
				});
			}
			gridTable.setModel(tableDataModel);
			gridTable.destroyCustomData();

			/*attach update events to the table*/
			gridTable.attachEvent("updateStarted", null, this.onUpdateStarted, this);
			gridTable.attachEvent("updateFinished", null, this.onUpdateFinished, this);
			var template = new sap.m.ColumnListItem({
				type: "Active",
				customData: new sap.ui.core.CustomData({
					key: "itemPressCustomData",
					value: variantData
				})
			});

			fields.forEach(function (field) {
				/*create the sorter and filter array*/
				if (!fromXSJS) {
					if (field.Sort_Op) {
						sortArr.push(field);
					}

					if (String(field.IsParameter) !== "true" && field.Filter_Val) {
						field.Filter_Val.forEach(function (filterVal) {
							if (filterVal.val_high) {
								params.filter.push(new sap.ui.model.Filter({
									path: field.Fieldname,
									operator: filterVal.filter_op.toLowerCase(),
									value1: filterVal.val_low,
									value2: filterVal.val_high,
									and: false
								}));
							} else {
								params.filter.push(new sap.ui.model.Filter({
									path: field.Fieldname,
									operator: filterVal.filter_op.toLowerCase(),
									value1: filterVal.val_low,
									and: false
								}));
							}
						}, this);
					}
				}
				if ((field.Visible && field.Visible.toLowerCase() === "true") || field.Fieldname === "#GROUPINGID") {
					// params.selectParams = params.selectParams + field.Fieldname + ",";

					var isMeasure = field.Aggr_Oper ? true : false;
					var width = (field.ColumnWidth && !isNaN(parseFloat(field.ColumnWidth, 10))) ? (parseFloat(field.ColumnWidth, 10) * 10) :
						180;
					var hdrColumn = new sap.m.Column({
						width: width + "px",
						hAlign: (isMeasure && isMeasure === true) ? "End" : "Begin",
						vAlign: "Middle"
					});
					var column = new sap.m.Column({
						width: width + "px",
						hAlign: (isMeasure && isMeasure === true) ? "End" : "Begin",
						vAlign: "Middle"
					});
					hdrColumn.setHeader(new sap.m.Text({
						width: "100%",
						text: field.FieldDescription
					}));
					headerTable.addColumn(hdrColumn);
					hdrColumn.setVisible(field.Fieldname === "#GROUPINGID" ? false : true);
					column.setVisible(field.Fieldname === "#GROUPINGID" ? false : true);

					/*Different Types of Controls*/
					var cell;
					switch (field.FieldType && field.FieldType.toLowerCase()) {
					case "download":
						cell = Controls.download(field, variantData, this);
						break;
					case "button":
						cell = Controls.button(field, variantData, this);
						break;
						/*new scenario to create a segmented Button for approve/Reject.
						will create a segemented button with text "Approve/Reject"*/
					case "approvereject":
						cell = Controls.approvereject(field, variantData, this);
						break;
					default:
						params.selectParams += field.Fieldname.trim() + ",";
						cell = new sap.m.Text({
							width: "100%",
							customData: [new sap.ui.core.CustomData({
									key: "fieldData",
									value: field
								}),
								new sap.ui.core.CustomData({
									key: "variantData",
									value: variantData
								})
							]
						}).bindProperty("text", {
							path: field.Fieldname,
							formatter: function (cellVal) {
								var fieldData = this.data("fieldData"),
									fVariantData = this.data("variantData"),
									fieldType = fieldData.FieldType,
									formatStyle = fieldData.FormatStyle,
									fracDigits = fieldData.DecPlaces,
									value = cellVal;
								var bindingPath = this.getBinding("text").sPath;
								if (bindingPath === "#GROUPINGID") {
									if (cellVal !== null) {
										var item = this.getParent();
										item.setType(sap.m.ListType.Inactive);
										item.rerender();
										item.addStyleClass("brsSubTotalRow").addStyleClass("brsDefaultCursor");
									}
								}

								if (fVariantData && fVariantData.AppVariantType.toLowerCase() === "sptable_period" || fVariantData.AppVariantType.toLowerCase() ===
									"sptable_period_flex" || fVariantData.AppVariantType.toLowerCase() ===
									"sptable_lcomm_month" || fVariantData.AppVariantType.toLowerCase() === "sptable_lcomm_year") {
									if (cellVal) {
										var delimiter = "|";
										var splCellVal = Utilities.spTableFormatter(cellVal, delimiter);
										if (splCellVal) {
											var value1 = splCellVal.value;
											var colorCode = splCellVal.colorCode;
											var value2 = splCellVal.value2;

											//color the cell
											switch (colorCode.toLowerCase()) {
											case "neutral":
												this.addStyleClass("sptableNeutral");
												break;
											case "warning":
												this.addStyleClass("sptableWarning");
												break;
											case "critical":
												this.addStyleClass("sptableCritical");
												break;
											case "good":
												this.addStyleClass("sptableGood");
												break;
											default:

											}
										}
									}
								}
								if (fVariantData && (fVariantData.AppVariantType.toLowerCase() === "sptable_period" || fVariantData.AppVariantType.toLowerCase() ===
										"sptable_period_flex")) {
									if (value2) {
										//Comma separated Work Orders
										var woArr = value2.split(",");
										value = "";
										var val1 = Utilities.formatValue(value1, fieldType, formatStyle, fracDigits);
										// value = val1;
										woArr.forEach(function (woID) {
											value = value + "\n" + woID;
										}, this);
										value = value + "\n" + val1;
									} else {
										value = Utilities.formatValue(value1 || value, fieldType, formatStyle, fracDigits);
									}
								} else {
									value = Utilities.formatValue(value1 || value, fieldType, formatStyle, fracDigits);
								}
								return value;
							}

						});
					}
					template.addCell(cell);
					gridTable.addColumn(column);
				}
			}, this);

			if (fromXSJS === false) {
				paramStr = this.getParamterString(fields);
				var filters = Utilities.getFilterPaneData(this, true);
				if (filters && filters.length && filters.length > 0) {
					params.filter = Utilities._prepareFilters(filters, this);
				}

				bindObject = {
					path: dataPath,
					template: template
				};

				//Add the AppID and the AppVariantID
				if (bindObject.parameters && bindObject.parameters.custom) {
					bindObject.parameters.custom = {
						AppID: this.variantData.AppID,
						AppVariantID: this.variantData.AppVariantID
					};
				} else {
					bindObject.parameters = {
						custom: {
							AppID: this.variantData.AppID,
							AppVariantID: this.variantData.AppVariantID
						}
					};
				}

				if (params.selectParams) {
					//Remove the last comma
					params.selectParams = params.selectParams.replace(/,([^,]*)$/, "");
					if (bindObject.parameters) {
						bindObject.parameters.select = params.selectParams;
					} else {
						bindObject.parameters = {
							select: params.selectParams
						};
					}
				}

				if (sortArr && sortArr.length > 0) {
					var sortedArr = sortArr.sort(Utilities.getSortByValFunc("Sort_Order"), this);
				}

				if (sortedArr && sortedArr.length > 0) {
					/*Create the sorter*/
					var orderByArr = [];
					sortedArr.forEach(function (sortObj) {
						var bDescending = (sortObj.Sort_Op && sortObj.Sort_Op.toUpperCase() === "ASC") ? false : true;
						orderByArr.push(new sap.ui.model.Sorter({
							path: sortObj.Fieldname,
							descending: bDescending
						}));
					}, this);
					bindObject.sorter = orderByArr;
				}

				if (params && params.filter) {
					bindObject.filters = [params.filter];
				}

				if (paramStr) {
					//Remove the last comma.
					bindObject.path += "Parameters" + paramStr;
				}
			} else {
				bindObject = {
					path: "/",
					template: template
				};
			}

			if (this.oDelegate) {
				gridTable.removeDelegate(this.oDelegate);
				this.oDelegate = undefined;
			}
			if (variantData && variantData.AppVariantType === "sptable_period" || variantData.AppVariantType === "sptable_period_flex" ||
				variantData.AppVariantType === "sptable_lcomm_month" ||
				variantData.AppVariantType === "sptable_lcomm_year") {
				this.oDelegate = gridTable.addEventDelegate({
					onAfterRendering: $.proxy(function (oEvt) {
						this.spTableFormattter(oEvt);
					}, this)
				});
			}

			gridTable.bindAggregation("items", bindObject);
			gridTable.setNoDataText(this.oBundle.getProperty("noData"));
		},

		spTableFormattter: function (oEvt) {
			$(".sptableNeutral").parent().css({
				"background": "#64aadf"
			});
			$(".sptableWarning").parent().css({
				"background": "#e9a427"
			});
			$(".sptableCritical").parent().css({
				"background": "#db3b3c"
			});
			$(".sptableGood").parent().css({
				"background": "#39a651"
			});
		},

		getParamterString: function (fields) {
			//Create parameters to pass to xsodata
			var paramStr;
			for (var i = 0; i < fields.length; i++) {
				var field = fields[i];
				if (field.IsParameter && field.IsParameter.toLowerCase() === "true") {
					//Check if the field has filter values
					if (field.Filter_Val && field.Filter_Val.length) {
						if (field.Filter_Val.length === 0 || field.Filter_Val.length >= 2) {
							paramStr = undefined;
							break;
						} else {
							if (paramStr) {
								paramStr += field.Fieldname + "='" + field.Filter_Val[0].val_low + "', ";
							} else {
								//First time
								paramStr = "(" + field.Fieldname + "='" + field.Filter_Val[0].val_low + "', ";
							}
						}
					}
				}
			}
			/*Remove the last comma and close the braces*/
			paramStr = (paramStr !== undefined) ? paramStr.replace(/,\s*$/, "").trim() + ")/Results" : undefined;
			return paramStr;
		},

		onTableItemPress: function (oEvt) {
			var item = oEvt.getParameter("listItem");
			if (item.getType() === "Inactive") {
				return;
			}
			this.selectedItem = item;
			var variantData = item.data("itemPressCustomData");
			if (variantData.AppVariantType && variantData.AppVariantType.toLowerCase() === "verticaltable") {
				return;
			}
			item.addStyleClass("brsItemSelected");
			var dv = this.getView().byId("idBRSTableMasterDetailContainer");
			//Open the Detail Section
			if (variantData.IsDetail && variantData.IsDetail.toLowerCase() === "true") {
				if (item && item instanceof sap.m.ColumnListItem && !item.hasStyleClass("brsSubTotalRow")) {
					/*Exclude subTotal row from displaying details*/
					this.toggleDetailView(true);
					DetailView.createDetailSection(variantData, dv, item, this);
				}
			} else {
				//Open a jumpTo Dialog
				this.loadJumpToInfo();
			}
		},

		loadJumpToInfo: function (oEvt) {
			if (oEvt && oEvt.getSource() && oEvt.getSource().data("fromDetail")) {
				this.nwFlag = true;
			}
			if (this.selectedItem) {
				var variantData = this.selectedItem.data("itemPressCustomData");
				var jtModel = new sap.ui.model.json.JSONModel();
				var jtData = variantData.JumpToTargets;
				jtModel.setData(jtData);

				if (jtData && jtData.length && jtData.length > 0) {
					if (!this.jumpToDialog) {
						this.jumpToDialog = sap.ui.xmlfragment("brs_demo_tablemaster.fragments.JumpToDialog", this);
						this.getView().addDependent(this.jumpToDialog);
					}
					var list = this.jumpToDialog.getContent()[0];
					// list.attachEventOnce("updateFinished", this.onJTUpdateFinished, this);
					list.setModel(jtModel);
					var jtTemplate = list.getBindingInfo("items").template;
					var jtSorter = new sap.ui.model.Sorter("", false, function (oContext) {
						var mRecord = oContext.getObject();
						return {
							key: mRecord.ToAppID,
							text: mRecord.ToAppDescription
						};
					}, this.jtComparator);
					list.bindAggregation("items", {
						path: "/",
						template: jtTemplate,
						sorter: jtSorter
					});
					if (!this.jumpToDialog.isOpen()) {
						this.jumpToDialog.open();
					}
				}
			}
		},

		closeJumpToDialog: function (oEvt) {
			if (this.jumpToDialog && this.jumpToDialog.isOpen()) {
				this.jumpToDialog.close();
			}
		},

		toggleDetailView: function (state) {

			var sc = this.getView().byId("idBRSTableMasterScrollContainer");
			sc.setHorizontal(true);
			sc.setVertical(false);
			var hdrTable = this.getView().byId("idBRSTableMasterVariantReponsiveDataTableHeader");
			var hdrTableHeight = parseFloat($("#" + hdrTable.getId()).css("height"));
			var scItems = this.getView().byId("idBRSTableMasterScrollContainertBody");
			var dv = this.getView().byId("idBRSTableMasterDetailContainer");
			var tb = this.getView().byId("idBRSTableMasterToolbar");
			tb.setVisible(true);
			var height;
			var jSC = jQuery.sap.byId(sc.getId());
			var jSCItems = jQuery.sap.byId(scItems.getId());
			if (state === true) {
				jSC.css("height", "calc(40% - 50px)");
				height = parseFloat(jSC.css("height"));
				jSCItems.css("height", (height - hdrTableHeight - 16) + "px");
				// jSCItems.css("height", "calc(40% - 50px - 58px)");
				dv.setHeight("60%").addStyleClass("brsAnimation4ms");
				dv.setVisible(true);
			} else {
				jSC.css("height", "calc(100% - 48px)");
				height = parseFloat(jSC.css("height"));
				jSCItems.css("height", (height - hdrTableHeight - 16) + "px");
				dv.setHeight("0px").addStyleClass("brsAnimation4ms");
				dv.setVisible(false);

				/*Deselect the selected*/
				var table = this.getView().byId("idBRSTableMasterVariantReponsiveDataTable");
				var item = table.getSelectedItem();
				if (item && item instanceof sap.m.ColumnListItem) {
					item.setSelected(false);
				}
			}
		},

		onDetailExpand: function (oEvt) {
			var icon = oEvt.getSource().getIcon();
			var sc = this.getView().byId("idBRSTableMasterScrollContainer");
			var jSC = jQuery.sap.byId(sc.getId());
			var dv = this.getView().byId("idBRSTableMasterDetailContainer");
			var tb = this.getView().byId("idBRSTableMasterToolbar");
			if (icon.match("exit") && icon.match("exit") !== null) {
				oEvt.getSource().setIcon("sap-icon://full-screen");
				jSC.css("height", "calc(40% - 50px)");
				dv.setHeight("60%");
				tb.setVisible(true);
			} else {
				oEvt.getSource().setIcon("sap-icon://exit-full-screen");
				jSC.css("height", "0px");
				dv.setHeight("100%");
				tb.setVisible(false);
			}
		},

		/*Action to be taken for for action buttons*/
		onActionBtnPress: function (oEvt) {
			var src = oEvt.getSource();
			var data = src.data();
			var parentListItem = this.getView().byId("idBRSTableMasterVariantReponsiveDataTable").getSelectedItem();
			if (!parentListItem || !parentListItem instanceof sap.m.ColumnListItem) {
				parentListItem = src.getParent();
			}
			var listItem = src.getEventingParent();
			ActionClass.actionBtnSetup(data, parentListItem, this, listItem);
		},

		getListItem: function (src) {
			if (src instanceof sap.m.ColumnListItem) {
				return src;
			} else {
				this.getListItem(src.getParent());
			}
		},

		onUpdateStarted: function (oEvt) {
			var table = oEvt.getSource();
			// table.setBusy(true);
		},

		onUpdateFinished: function (oEvt) {
			var table = oEvt.getSource();
			var queryInfo = table.data("_queryInfo");
			var varSel = this.getView().byId("idBRSTableMasterVariantSelect");
			var variantData = varSel.getSelectedItem().data("variantData");
			//set width of the items table
			this.getView().byId("idBRSTableMasterScrollContainertBody").setWidth("auto").setHeight("auto");
			// this.getView().byId("idBRSTableMasterScrollContainertBody").setHeight("auto");
			table.setWidth("100%");
			table.setBusy(false);
			jQuery.sap.delayedCall(0, this, function () {
				var jItemsTable = jQuery.sap.byId(table.getId());
				var jItemsTblWidth = parseFloat(jItemsTable.css("width"), 10);
				jItemsTblWidth = jItemsTblWidth ? (jItemsTblWidth - 8) + "px" : "100%";
				table.setWidth(jItemsTblWidth);
				this.toggleDetailView(false);
				this.setGrandTotalRow(table);

				//Display the message for Max Record
				if (!this.allDataFlag && queryInfo && queryInfo.displayMaxRecordMessage &&
					queryInfo.displayMaxRecordMessage === "true") {
					this.displayMaxRecordMessage(queryInfo);
				}
			}, [queryInfo]);
		},

		displayMaxRecordMessage: function (queryInfo) {
			var that = this;
			var oBundle = this.getView().getModel("i18n");
			var text = oBundle.getResourceBundle().getText("maxRecMessage", [queryInfo.dataCount || "0"]);
			var maxMessageDiag = new sap.m.Dialog({
				icon: "sap-icon://message-information",
				title: that.oBundle.getProperty("message"),
				horizontalScrolling: false,
				contentWidth: "550px",
				verticalScrolling: true,
				content: [
					new sap.m.Text({
						text: text
					}).addStyleClass("brsWarning")
				],
				buttons: [
					new sap.m.Button({
						text: that.oBundle.getProperty("loadall"),
						press: function (oEvt) {
							that.loadAllData(maxMessageDiag);
						}

					}),
					new sap.m.Button({
						text: that.oBundle.getProperty("cancelapplyfilters"),
						press: $.proxy(function (oEvt) {
							if (maxMessageDiag && maxMessageDiag.isOpen()) {
								maxMessageDiag.close();
							}
						}, this)
					})
				]
			}).addStyleClass("sapUiContentPadding");

			if (!maxMessageDiag.isOpen()) {
				maxMessageDiag.open();
			}
		},

		loadAllData: function (msgDialog) {
			//set allData Flag to true;
			this.allDataFlag = true;
			this.intialLoadMessageDisplayed = true;
			if (msgDialog && msgDialog.isOpen()) {
				msgDialog.close();
			}
			var selectedKey = this.getView().byId("idBRSTableMasterVariantSelect").getSelectedKey();
			this.getTableConfig(selectedKey, false);
		},

		setGrandTotalRow: function (table) {
			var tblModel = table.getModel();
			if (tblModel && tblModel.getData()) {
				var tblData = tblModel.getData();
				if (tblData && tblData instanceof Array) {
					var dataLength = tblData.length;
					var lastItem = table.getItems()[dataLength - 1];
					if (lastItem) {
						var cells = lastItem.getCells();
						cells.forEach(function (cell) {
							var bindingPath = cell.getBindingPath("text");
							if (bindingPath === "#GROUPINGID") {
								var bindingInfo = cell.getBindingInfo("text");
								if (bindingInfo && bindingInfo.binding && bindingInfo.binding.getValue() !== null && bindingInfo.binding.getValue() > 0) {
									var fCell = lastItem.getCells()[0];
									if (fCell && fCell instanceof sap.m.Text) {
										fCell.setText(this.getView().getModel("i18n").getProperty("grandTotal"));
									}
									lastItem.setType(sap.m.ListType.Inactive);
									lastItem.rerender();
									lastItem.addStyleClass("brsGrandTotalRow").addStyleClass("brsDefaultCursor");
								}
							}
						}, this);
					}
				}
			}
		},

		/*
		Function to load up the variant Data for user change
		 */
		onVariantSettingBtnPressed: function (bFPApply) {
			var variantConfigModel;
			if (this._variantFragment) {
				this._variantFragment.destroy(true);
			}
			this._variantFragment = sap.ui.xmlfragment("brs_demo_tablemaster.fragments.VariantDialog", this);
			this._variantFragment.setBusyIndicatorDelay(0);
			this.getView().addDependent(this._variantFragment);
			variantConfigModel = new sap.ui.model.json.JSONModel();
			variantConfigModel.setDefaultBindingMode(sap.ui.model.BindingMode.OneWay);
			this.getView().setModel(variantConfigModel, "tableVariantAFModel");

			variantConfigModel.setData();
			if (!bFPApply || (bFPApply && bFPApply !== true && !this._variantFragment.isOpen())) {
				this._variantFragment.open();
			}
			this._variantFragment.setBusy(true);
			this.loadVariantConfigData(variantConfigModel);
		},

		loadVariantConfigData: function (variantConfigModel) {
			var varSel = this.getView().byId("idBRSTableMasterVariantSelect");
			if (!varSel.getSelectedItem() || !varSel.getSelectedItem().data("variantData")) {
				this._variantFragment.setBusy(false);
				return;
			}

			var variantConfgData = varSel.getSelectedItem().data("variantData");
			/*Create Filter Data separately*/
			if (variantConfgData) {
				var variantJSONData = JSON.parse(JSON.stringify(variantConfgData));

				/*Provide UI level Indices to all Fields in the variant*/
				variantJSONData.Fields.forEach(function (field, idx) {
					field.DisplayOrder = idx;
					if (field.Sort_Op === "DESC") {
						field.Sort_Op = "Descending";
					} else if (field.Sort_Op === "ASC") {
						field.Sort_Op = "Ascending";
					}
				}, this);
				if (variantJSONData && variantJSONData.Fields && variantJSONData.Fields.length > 100) {
					variantConfigModel.setSizeLimit(variantJSONData.Fields.length);
				} else {
					variantConfigModel.setSizeLimit(100);
				}
				variantConfigModel.setData(variantJSONData);
				var filterdata = [],
					filterObj;
				variantConfgData.Fields.forEach(function (field) {
					if (field.Filter_Val && field.Filter_Val.length && field.Filter_Val.length > 0) {
						if (!(field.Filter_Val instanceof Object)) {
							filterObj = {
								Fieldname: field.Fieldname,
								filter_op: "EQ",
								val_low: field.Filter_Val,
								val_high: null
							};
							filterdata.push(filterObj);
						} else {
							field.Filter_Val.forEach(function (filter_val) {
								filterObj = {
									Fieldname: filter_val.Fieldname,
									filter_op: filter_val.filter_op.toUpperCase()
								};
								if (filter_val.val_low) {
									filterObj.val_low = filter_val.val_low;
								}
								if (filter_val.val_high) {
									filterObj.val_high = filter_val.val_high;
								}
								filterdata.push(filterObj);
							}, this);
						}
					}
				}, this);
				var tableVariantFilterModel = new sap.ui.model.json.JSONModel(filterdata);
				tableVariantFilterModel.setDefaultBindingMode(sap.ui.model.BindingMode.TwoWay);
				this.getView().setModel(tableVariantFilterModel, "tableVarFilterModel");
			} else {
				sap.m.MessageBox.alert(this.oBundle.getProperty("configLoadErr"));
			}
			this._variantFragment.setBusy(false);
		},

		changeVariantItem: function (oEvt) {
			var sId = oEvt.sId;
			var src = oEvt.getSource();
			var data, itemData;
			switch (sId) {
			case "addSortItem":
				itemData = oEvt.getParameter("sortItemData");
				data = {
					columnKey: itemData.getColumnKey(),
					// 	key: oEvt.index,
					key: oEvt.getParameter("key"),
					operation: itemData.getOperation()
				};
				src.addSortItem(new sap.m.P13nSortItem(data));
				break;
			case "addFilterItem":
				itemData = oEvt.getParameter("filterItemData");
				data = {
					columnKey: itemData.getProperty("columnKey"),
					// 	key: oEvt.index,
					operation: itemData.getProperty("operation"),
					value1: itemData.getProperty("value1") || null,
					value2: itemData.getProperty("value2") || null,
					exclude: itemData.getProperty("exclude") || false
				};
				src.addFilterItem(new sap.m.P13nFilterItem(data));
				break;

			case "addGroupItem":
				itemData = oEvt.getParameter("groupItemData");
				data = {
					columnKey: itemData.getProperty("columnKey"),
					key: oEvt.getParameter("index")
				};
				src.addGroupItem(new sap.m.P13nGroupItem(data));
				break;

			case "removeSortItem":
				src.removeSortItem(src.getSortItems()[oEvt.getParameter("index")]);
				break;

			case "removeFilterItem":
				src.removeFilterItem(src.getFilterItems()[oEvt.getParameter("index")]);
				break;
			case "removeGroupItem":
				src.removeGroupItem(src.getGroupItems()[oEvt.getParameter("index")]);
				break;
			default:

			}
		},

		reorderColumnsItem: function (oEvt, called) {
			/*Function to reorder the list of columns*/
			var item = oEvt.getParameter("existingItems")[0];
			item.setIndex(item.getIndex());
		},

		handleOK: function (oEvt) {
			var variantDialog = oEvt.getSource();

			if (variantDialog) {
				if (!this._confirmVariantDialog) {
					this._confirmVariantDialog = sap.ui.xmlfragment("brs_demo_tablemaster.fragments.VariantSaveConfirmation", this);
					this._confirmVariantDialog.setBusyIndicatorDelay(0);
				}
				this.getView().addDependent(this._confirmVariantDialog);
				var variantData = this.getView().getModel("tableVariantAFModel").getData();
				if (variantData && (variantData.Type === "User" && variantData.Username !== "_#SUPER")) {
					//User Variant. Display the ID and Variant
					var variantId = sap.ui.getCore().byId("idBRSTableMasterVariantSaveID");
					var variantDesc = sap.ui.getCore().byId("idBRSTableMasterVariantSaveDesc");
					var isSuperChckBox = sap.ui.getCore().byId("idBRSTableMasterVariantSaveSuperChk");
					//Diable the checkBox if ID is $Default
					if (variantData.Username && variantData.Username !== "_#SUPER") {
						isSuperChckBox.setEnabled(false);
					}
					if (variantId) {
						variantId.setValue(variantData.UsrVariantID);
					}
					if (variantDesc) {
						variantDesc.setValue(variantData.Description);
					}
				}

			}
			if (!this._confirmVariantDialog.isOpen()) {
				this._confirmVariantDialog.open();
			}
		},

		handleCancel: function (oEvt) {
			var src = oEvt.getSource();
			if (src && src instanceof sap.m.P13nDialog && src.isOpen()) {
				src.close();
			}
		},

		handleReset: function () {
			this.onVariantSettingBtnPressed();
		},

		onVariantAction: function (oEvt, bSave) {
			var src, actionType;
			if (this._confirmVariantDialog) {
				this._confirmVariantDialog.setBusyIndicatorDelay(0);
			}
			src = oEvt.getSource();
			actionType = src.data("data");

			if (actionType === "cancel") {
				this._confirmVariantDialog.close();
			} else {
				//Get the data from all the panels and store it in the data to send
				//get the Data to create a new Model and Update it
				var description = this.getView().getModel("tableVariantAFModel").getData().Description;
				var userVariantID = "$DEFAULT";
				var userVariantDescription = "$DEFAULT " + description;
				if (description.startsWith("$")) {
					userVariantDescription = description;
				}
				var isSuper = sap.ui.getCore().byId("idBRSTableMasterVariantSaveSuperChk");
				if (actionType === "save") {
					var variantId = sap.ui.getCore().byId("idBRSTableMasterVariantSaveID");
					var variantDesc = sap.ui.getCore().byId("idBRSTableMasterVariantSaveDesc");
					if ((variantId && variantId.getValue())) {
						userVariantID = variantId.getValue().trim();
					} else {
						MessageBox.alert(this.oBundle.getProperty("varSaveErr"));
						return;
					}

					if (variantDesc && variantDesc.getValue()) {
						userVariantDescription = variantDesc.getValue().trim();
					} else {
						MessageBox.alert(this.oBundle.getProperty("varSaveErr"));
						return;
					}
				} else if (actionType === "apply" && bSave !== false) {
					var checkSuper = isSuper.getSelected() || false;
					if (checkSuper) {
						MessageBox.alert(this.oBundle.getProperty("sVarSaveErr"));
						return;
					}
				}

				if (this._confirmVariantDialog) {
					this._confirmVariantDialog.setBusy(true);
				}
				/*new config Data to be updated/created*/
				var newVariantModelData = {
					"AppID": this.getView().getModel("tableVariantAFModel").getData().AppID,
					"AppVariantID": this.getView().getModel("tableVariantAFModel").getData().AppVariantID,
					"Username": this.getView().getModel("tableVariantAFModel").getData().Username,
					"UsrVariantID": userVariantID,
					"UsrVariantDescription": userVariantDescription,
					"ChartType": null,
					"SUserVariantID": (this.getView().getModel("tableVariantAFModel").getData().Username === "_#SUPER") ? this.getView().getModel(
						"tableVariantAFModel").getData().UsrVariantID : null,
					"IsSuper": (isSuper && isSuper.getSelected()) ? isSuper.getSelected() + "" : "false",
					"Fields": []
				};

				//Don't send IsSuper if the variant is user variant.
				if (newVariantModelData.IsSuper && newVariantModelData.IsSuper === "false") {
					delete newVariantModelData.IsSuper;
				}

				var tempArr = [];
				var variantPanels = this._variantFragment.getPanels();
				//Get data fromColumns Panel
				var columnsPanel = variantPanels[0];
				if (columnsPanel && columnsPanel instanceof sap.m.P13nColumnsPanel) {
					var columnsItems = columnsPanel.getColumnsItems();
					columnsItems.forEach(function (columnsItem) {
						// if (columnsItem.getVisible()) {
						if (tempArr.indexOf(columnsItem.getColumnKey()) > -1) {
							jQuery.sap.log.error("Duplicate Field:" + columnsItem.getColumnKey());
						}
						tempArr.push(columnsItem.getColumnKey());
						var fieldData = {
							"Fieldname": columnsItem.getColumnKey(),
							"FieldDescription": null,
							"Aggr_Oper": null,
							"Filterable": null,
							"Sort": null,
							"Visible": columnsItem.getVisible() + "",
							"Filter_Val": null,
							"DisplayOrder": (columnsItem.getVisible && columnsItem.getIndex() !== undefined) ? columnsItem.getIndex() + 1 : null,
							"FieldGroup": null,
							"SubTotal": null,
							"FieldType": null,
							"Sortable": null,
							"Sort_Op": null,
							"Sort_Order": null,
							"ChartRole": null,
							"IsParameter": columnsItem.data("IsParameter")
						};
						if (fieldData.IsParameter && (fieldData.IsParameter.toLowerCase() === "true" || fieldData.IsParameter === true)) {
							fieldData.Visible = null;
							fieldData.DisplayOrder = null;
						}
						newVariantModelData.Fields.push(fieldData);
						// }
					}, this);
				}

				//Get Data from Sort Panel
				var sortPanel = variantPanels[1];
				if (sortPanel && sortPanel instanceof sap.m.P13nSortPanel) {
					var sortItems = sortPanel.getSortItems();
					//Use the tmpArr to find the index and push in the sort params
					sortItems.forEach(function (sortItem, idxn) {
						var key = sortItem.getColumnKey();
						var idx = tempArr.indexOf(key);
						if (idx !== -1) {
							var fieldData = newVariantModelData.Fields[idx];
							fieldData.Sortable = true;
							fieldData.Sort_Op = sortItem.getOperation() === ("Ascending" || "ASC") ? "ASC" : "DESC";
							fieldData.Sort_Order = idxn + 1;
						}
					}, this);
				}
				//Get Data from Filter Panel
				var filterPanel = variantPanels[2];
				if (filterPanel && filterPanel instanceof sap.m.P13nFilterPanel) {
					//Use the tmpArr to find the index and push in the filter params
					var filterItems = filterPanel.getFilterItems();
					filterItems.forEach(function (filterItem) {
						var key = filterItem.getColumnKey();
						var idx = tempArr.indexOf(key);
						if (idx !== -1) {
							var fielddata = newVariantModelData.Fields[idx];
							fielddata.Filterable = true;
							if (fielddata.Filter_Val === null) {
								fielddata.Filter_Val = new Array();
							}
							fielddata.Filter_Val.push({
								Fieldname: key,
								filter_op: filterItem.getOperation().toLowerCase(),
								val_low: filterItem.getValue1(),
								val_high: filterItem.getValue2() || null
							});
						}
					}, this);
				}
				//Get Data from GroupBy Panel
				var subtotalPanel = variantPanels[3];
				if (subtotalPanel && subtotalPanel instanceof sap.m.P13nGroupPanel) {
					var groupItems = subtotalPanel.getGroupItems();
					groupItems.forEach(function (groupItem, idxn) {
						var key = groupItem.getColumnKey();
						var idx = tempArr.indexOf(key);
						if (idx !== -1) {
							var fielddata = newVariantModelData.Fields[idx];
							fielddata.SubTotal = (idxn + 1) + "" || null;
						}
					}, this);
				}

				/*Call the variant save service*/
				if (bSave === false) {
					if (this._confirmVariantDialog) {
						this._confirmVariantDialog.setBusy(false);
					}
					return {
						"newVariantModelData": newVariantModelData,
						"tempArr": tempArr
					};
				} else {
					this.saveVariantConfig(newVariantModelData, false);
					// this._confirmVariantDialog.setBusy(false);
				}

			}
		},

		saveVariantConfig: function (newVariantConfigData, bloadFilterUI) {
			this.getView().setBusy(true);
			this._bCallMergeForlm = undefined;

			var selectedKey = newVariantConfigData.AppVariantID + " " + newVariantConfigData.UsrVariantID;
			if (newVariantConfigData.IsSuper) {
				selectedKey = selectedKey + " " + "_#SUPER";
			}

			var url = this.serviceURL + "/BRS/HAA/services/GetConfig.xsjs?AppID=" + newVariantConfigData.AppID;
			if (!newVariantConfigData.IsSuper || newVariantConfigData.IsSuper !== "true") {
				url += "&UsrVariantID=" + newVariantConfigData.UsrVariantID;
			}

			$.ajax({
				"url": url,
				type: "POST",
				data: JSON.stringify(newVariantConfigData),
				contentType: "application/json",
				context: this,
				success: function (retData) {
					sap.ui.core.BusyIndicator.hide();
					this.intialLoadMessageDisplayed = true;
					//Saved successfully. reload the data
					//Reload the select model 'variantModel' and restart the process for the table.
					if (this._variantFragment) {
						this._variantFragment.close();
					}
					if (this._confirmVariantDialog) {
						this._confirmVariantDialog.setBusy(false);
						this._confirmVariantDialog.close();
					}
					var variantModel = this.getView().getModel("variantModel");
					if (retData.results.Variants && retData.results.Variants.length > 0) {
						retData.results.Variants = retData.results.Variants.filter(function (variant) {
							return variant.AppVariantType.toLowerCase() === "standard" || variant.AppVariantType.toLowerCase() === "standard_updt" ||
								variant.AppVariantType.toLowerCase() === "verticaltable" ||
								variant.AppVariantType.toLowerCase() ===
								"sptable_period" || variant.AppVariantType.toLowerCase() ===
								"sptable_period_flex" || variant.AppVariantType.toLowerCase() === "sptable_lcomm_month" || variant.AppVariantType.toLowerCase() ===
								"sptable_lcomm_year" || variant.AppVariantType.toLowerCase() === "spltable_rff";
						});
						Utilities.sortVariantList(retData.results.Variants);
					}
					variantModel.setData(retData.results.Variants);
					variantModel.refresh(true);
					sap.m.MessageToast.show(this.oBundle.getProperty("varSaveSuccess"));
					this.getTableConfig(selectedKey, false);
				},
				error: function (oErr) {
					sap.ui.core.BusyIndicator.hide();
					if (this._confirmVariantDialog) {
						this._confirmVariantDialog.setBusy(false);
					}
					this.getView().setBusy(false);
					MessageBox.alert(this.oBundle.getProperty("err_gen"));
				}
			});
		},

		/*Export options popup*/
		onExportBtnPressed: function (oEvt) {
			var oSrc = oEvt.getSource();
			// if (!this._exportFrgmt) {
			// 	this._exportFrgmt = sap.ui.xmlfragment("brs_demo_tablemaster.fragments.ExportOptions", this);
			// 	this.getView().addDependent(this._exportFrgmt);
			// }
			// this._exportFrgmt.openBy(oSrc);
			this._exportCSV(oSrc);
		},

		_exportCSV: function (oCtrl) {
			var exportURL = this.variantData.Service + "/" + this.variantData.ServEntity + "?AppID=" + this.variantData.AppID +
				"&AppVariantID=" + this.variantData.AppVariantID + "&csv=true";

			//create the Filter String if any
			var filters = Utilities.getFilterPaneData(this, true);
			var filterStr;
			if (filters && filters.length && filters.length > 0) {
				filterStr = Utilities._prepareFiltersAsString(filters, this);
			}

			if (filterStr && filterStr.length > 0) {
				exportURL += "&$filter=" + filterStr;
			}
			window.open(this.serviceURL + exportURL);
		},

		onExportSelection: function (oEvt) {
			var that = this;
			var oSrc = oEvt.getSource();
			var csvParam = oSrc.data("csvparam");
			if (csvParam === "CSVOutputWithComments") {
				MessageBox.show(that.oBundle.getProperty("commentsexportmsg"), {
					icon: sap.m.MessageBox.Icon.WARNING,
					actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
					title: that.oBundle.getProperty("warning"),
					initialFocus: MessageBox.Action.NO,
					onClose: function (msgBoxEvt) {
						if (msgBoxEvt === sap.m.MessageBox.Action.YES) {
							that.exportData(csvParam);
						}
					}
				});
			} else {
				that.exportData(csvParam);
			}
		},

		/*function to Export to Excel*/
		exportData: function (csvParam) {

			var varSel = this.getView().byId("idBRSTableMasterVariantSelect");
			if (varSel && varSel.getItems().length > 0) {
				var selectedItem = varSel.getSelectedItem();
				if (selectedItem) {
					var data = selectedItem.data("variantData");
					var appId = data.AppID;
					var appVariantId = data.AppVariantID;
					var userStr = "";
					if (data.Type !== "App") {
						if (data.Username === "_#SUPER") {
							userStr = "&UserVariant=" + data.UsrVariantID + "&IsSuper='true'";
						} else {
							userStr = "&Username=" + data.Username + "&UserVariant=" + data.UsrVariantID;
						}
					}
					if (appId && appVariantId) {
						if (data.AppVariantType && data.AppVariantType === "spltable_rff") {
							this.getView().setBusy(true);
							//Update the RFF Download Table
							var rffURL = this.serviceURL + "/BRS/HAA/services/GetData.xsjs?AppID=" + appId + "&AppVariant=" + appVariantId + userStr +
								"&RFF";
							$.ajax({
								url: rffURL,
								type: "GET",
								async: false,
								context: this,
								contentType: "application/json",
								success: function (oSucc) {
									this.getView().setBusy(false);
									var selectedKey = selectedItem.getKey();
									this.getTableConfig(selectedKey, false);
								},
								error: function (oErr) {
									this.getView().setBusy(false);
								}
							});
						}
						var timezoneffset = new Date().getTimezoneOffset();
						var exportURL = this.serviceURL + "/BRS/HAA/services/GetData.xsjs?AppID=" + appId + "&AppVariant=" + appVariantId + userStr +
							"&tz=" + timezoneffset +
							"&" + csvParam;
						window.open(exportURL);
					} else {
						MessageBox.alert(this.oBundle.getProperty("dataExportErr"));
					}
				} else {
					MessageBox.alert(this.oBundle.getProperty("dataExportErr"));
				}
			} else {
				MessageBox.alert(this.oBundle.getProperty("dataExportErr"));
			}
		},

		/*function to Clean up the Table Area*/
		cleanUp: function () {
			this.toggleDetailView(false);
			this.getView().byId("idInitialLoadVB").setVisible(false);
			var mTableHdr = this.getView().byId("idBRSTableMasterVariantReponsiveDataTableHeader");
			mTableHdr.setVisible(true);
			var mTable = this.getView().byId("idBRSTableMasterVariantReponsiveDataTable");
			mTable.setVisible(true);
			if (mTableHdr && mTableHdr instanceof sap.m.Table && mTableHdr.getColumns().length > 0) {
				mTableHdr.destroyColumns();
			}
			if (mTable && mTable instanceof sap.m.Table) {
				if (mTable.getColumns().length > 0) {
					mTable.destroyColumns();
				}

				if (mTable.getItems().length > 0) {
					mTable.destroyItems();
				}
			}
		},

		//#FilterPane
		toggleFilterPane: function (oEvt) {
			var sideContent = this.getView().byId("idBRSTableMasterMainContainer");
			var state = sideContent.hasStyleClass("brsFilterPaneSideContentShow");
			var fpIcon = this.getView().byId("idBRSFilterToggleL").getItems()[0];

			if (state === true) {
				sideContent.removeStyleClass("brsFilterPaneSideContentShow");
				sideContent.addStyleClass("brsFilterPaneSideContentHide");
				fpIcon.addStyleClass("brsFilterPaneSideContentHide");

			} else {
				sideContent.removeStyleClass("brsFilterPaneSideContentHide");
				sideContent.addStyleClass("brsFilterPaneSideContentShow");
				fpIcon.removeStyleClass("brsFilterPaneSideContentHide");
			}

			this.getView().byId("idBRSTableMasterScrollContainertBody").setWidth("auto");
			this.getView().byId("idBRSTableMasterScrollContainertBody").setHeight("auto");
			var hdrTable = this.getView().byId("idBRSTableMasterVariantReponsiveDataTableHeader");
			var table = this.getView().byId("idBRSTableMasterVariantReponsiveDataTable");
			table.setWidth("100%");
			hdrTable.setWidth("100%");
			table.setBusy(false);
			jQuery.sap.delayedCall(2, this, function () {
				var jHdrTable = jQuery.sap.byId(hdrTable.getId());
				var jHdrWidth = parseFloat(jHdrTable.css("width"), 10);
				// var jItemsTable = jQuery.sap.byId(table.getId());
				// var jItemsTblWidth = parseFloat(jItemsTable.css("width"), 10);
				// jItemsTblWidth = jItemsTblWidth ? (jHdrWidth) + "px" : "100%";
				hdrTable.setWidth(jHdrWidth);
				table.setWidth(jHdrWidth);
				// this.toggleDetailView(false);
				this.setGrandTotalRow(table);

			}, this);
		},

		/*Jump To Defined for Tables
			 - Get the filters from the Filter Panel
			 - Pass the Simple filter from this application
			*/
		jumpToTarget: function (oEvt) {
			this.jumpToCalled = true;
			var src = oEvt.getParameter("listItem"),
				tData = src.data("jumpTblData"),
				item = this.selectedItem,
				dataFilter = [],
				variantID, uv, excludeFieldList = [];

			/*Don't include Fields in the list*/
			if (tData && tData.ExcludeFieldList) {
				excludeFieldList = tData.ExcludeFieldList.split(",").map(function (oItem) {
					return oItem.trim();
				}, this);
			}
			/*Get the dimension fieldID List and the values for the same*/
			if (item && item instanceof sap.m.ColumnListItem) {
				var cells = item.getCells();
				cells.forEach(function (cell) {
					var field = cell.data("fieldData");
					var vData = cell.data("variantData");
					if (field && field.hasOwnProperty("Aggr_Oper") && field.Aggr_Oper === null) {
						/*Dimension Field. create a Filter Object*/
						if (cell && cell.getText()) {
							var type = field.FieldType;
							if (!type) {
								//Get the ID for Descriptions and pass the ID for the Filter Panel to work Fine
								var fValue = cell.getText();
								Utilities.getIdforDescription(function (oData, mappedId) {
									if (oData && oData === "noMappedId") {
										//No Mapping Parameter. Go ahead with the normal Description Passing
										/*Ideally should not pass descriptions*/
										dataFilter.push({
											"Fieldname": field.Fieldname,
											"filter_op": "eq",
											"val_low": fValue
										});
									} else if (oData && oData !== false && oData.results.length > 0) {
										var idVal = oData.results[0];
										dataFilter.push({
											"Fieldname": mappedId,
											"filter_op": "eq",
											"val_low": idVal[mappedId]
										});
									}
								}, this, vData, field.Fieldname, fValue);
								// dataFilter.push({
								// 	"Fieldname": field.Fieldname,
								// 	"filter_op": "eq",
								// 	"val_low": cell.getText()
								// });
							} else {
								var month, mins;
								var value = cell.getBinding("text").getValue();
								var text = new Date(value);
								if (!text) {
									return;
								}
								switch (type.toLowerCase()) {
								case "date":
									month = ((parseInt(text.getMonth(), 10) + 1) < 10) ? month = "0" + (parseInt(text.getMonth(), 10) + 1) : (parseInt(text.getMonth(),
										10) + 1);
									dataFilter.push({
										"Fieldname": field.Fieldname,
										"filter_op": "eq",
										"val_low": text.getFullYear() + "-" + month + "-" + text.getDate()
									});
									break;
								case "time":
									break;
								case "datetime":
									break;
								default:
								}
							}
						}
					}
				}, this);
			}
			if (sap.ushell) {
				if (tData.ToUsername) {
					/*Navigate to a User Variant*/
					variantID = tData.ToUsrVariant;
					uv = "User";
				} else {
					/*Navigate to a App Variant*/
					variantID = tData.ToAppVariant;
					uv = "App";
				}
				var appType = this.getAppTypeToNavigate(tData.ToAppID, true);

				if (appType !== false) {
					/*Navigate*/
					var crossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
					var sIntent;
					switch (appType.toUpperCase()) {
					case "REPORT":
						sIntent = "#brsdemotablemaster-Display";
						break;
					case "PORTFOLIO":
						sIntent = "#brscreapportfoliomanagement-Display";
						break;
					case "CASE":
						sIntent = "#brscreapcaseinteractions-Display";
						break;
					default:
						sIntent = "#brsdemochartmaster-Display";
					}

					// var sIntent = appType === "REPORT" ? "#brsdemotablemaster-Display" : "#brsdemochartmaster-Display";
					var oDeferred = crossAppNavigator.isIntentSupported([sIntent], this.getOwnerComponent());
					oDeferred.done($.proxy(function (oIntentSupported) {
						if (oIntentSupported && oIntentSupported[sIntent] && oIntentSupported[sIntent]["supported"] === true) {
							sap.ui.core.BusyIndicator.show(0);
							//Save the Filters before navigating to target.
							var jumpToID;
							Utilities.saveJumptoInfo(this, $.proxy(function (jtID) {
								jumpToID = jtID;
							}, this), $.proxy(function (oMsg) {}, this), dataFilter, excludeFieldList);

							var targetObject = {
								semanticObject: "",
								action: ""
							};

							var trgObj = sIntent.split("-");
							targetObject.semanticObject = trgObj[0].substr(1, trgObj[0].length);
							targetObject.action = trgObj[1];
							var paramsToSend = {
								"appId": tData.ToAppID,
								"appVariantId": variantID,
								"uv": uv
							};
							if (jumpToID) {
								paramsToSend.jtID = jumpToID;
							}

							var href = (crossAppNavigator && crossAppNavigator.hrefForExternal({
								target: targetObject,
								params: paramsToSend
							})) || "";
							if (this.nwFlag && this.nwFlag === true) {
								//open in a new Window
								sap.ui.core.BusyIndicator.hide();
								var currURL = window.location.href.split("#")[0] + href;
								sap.m.URLHelper.redirect(currURL, true);
							} else {
								//Navigate inside the App Container
								crossAppNavigator.toExternal({
									target: {
										shellHash: href
									}
								});
							}
						} else {
							sap.ui.core.BusyIndicator.hide();
							MessageBox.alert(this.oBundle.getProperty("navNotPossible"));
						}
					}, this));
				}
			} else {
				MessageBox.alert(this.oBundle.getProperty("navNotPossible"));
			}

		},

		getAppTypeToNavigate: function (appID, fromJumpTo) {
			var appType = false,
				appDesc = "";
			var service = this.serviceURL + "/BRS/HAA/services/AppConfig.xsodata";
			var oDModel = new sap.ui.model.odata.ODataModel(service, {
				json: true,
				defaultCountMode: "None"
			});

			oDModel.read("/Application", {
				async: false,
				urlParameters: {
					$select: "AppType,AppDescription",
					$filter: ["AppID eq '" + appID + "'"]
				},
				success: $.proxy(function (oData) {
					if (oData && oData.results && oData.results.length && oData.results.length > 0) {
						appType = oData.results[0].AppType;
						appDesc = oData.results[0].AppDescription || "";
					}

					if (!fromJumpTo) {
						if (!this.getView().getModel("appModel")) {
							var appModel = new JSONModel();
							appModel.setData({
								"appDesc": appDesc || ""
							});
							this.getView().setModel(appModel, "appModel");
						} else {
							this.getView().getModel("appModel").getData().appDesc = appDesc;
							this.getView().getModel("appModel").refresh(true);
						}
					}
				}, this),
				error: $.proxy(function (oErr) {
					jQuery.sap.log.error("err" + oErr.statusText);
					if (this.getView().getModel("appModel")) {
						this.getView().getModel("appModel").setData({});
					}
				}, this)
			});

			return appType;
		},

		_onAppHeaderAction: function (oEvt) {
			var action = oEvt.getSource().data("action");
			if (action === "duplicate") {
				window.open(location.href);
				return;
			}

			var appComponent = this.getOwnerComponent();
			if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService("CrossApplicationNavigation")) {
				sap.ui.core.BusyIndicator.show(0);
				var crossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
				switch (action) {
				case "back":
					crossAppNavigator.historyBack();
					break;
				case "home":
					var sIntent = "#Home-show";
					var oDeferred = crossAppNavigator.isIntentSupported([sIntent], appComponent);
					oDeferred.done($.proxy(function (oIntentSupported) {
						if (oIntentSupported && oIntentSupported[sIntent] && oIntentSupported[sIntent]["supported"] === true) {
							crossAppNavigator.toExternal({
								target: {
									shellHash: sIntent
								}
							});
						} else {
							sap.ui.core.BusyIndicator.hide();
							MessageBox.alert(this.oBundle.getProperty("navNotPossible"));
						}
					}));
					break;
				default:
				}
			}
		},

		/** Helper functions for custom formatting and type changes */
		booleanFormatter: function (oVal) {
			if ((oVal && oVal.toLowerCase() === "true") || (oVal === "X" || oVal === "x")) {
				return true;
			} else {
				return false;
			}
		},
		reverseBooleanFormatter: function (oVal) {
			if ((oVal && oVal.toLowerCase() === "true") || (oVal === "X" || oVal === "x")) {
				return false;
			} else {
				return true;
			}
		},

		filterOperatorFormatter: function (oVal) {
			if (oVal && oVal.toLowerCase() === "bt") {
				return "BT";
			}
		},

		variantIDFormatter: function (oVal) {
			var id;
			if (oVal) {
				if (oVal.Type === "App") {
					id = oVal.AppVariantID;
				} else if (oVal.Type === "User" && oVal.Username === "_#SUPER") {
					id = oVal.AppVariantID + " " + oVal.UsrVariantID + " " + oVal.Username;
				} else {
					id = oVal.AppVariantID + " " + oVal.UsrVariantID;
				}
				return id;
			}
		},

		jtComparator: function (a, b) {
			var aType = a.ToAppVariant,
				bType = b.ToAppVariant;
			if (a.ToUsername === "User" || a.ToUsername === "_#SUPER") {
				aType = a.ToUsrVariant;
			}

			if (b.ToUsername === "User" || b.ToUsername === "_#SUPER") {
				bType = b.ToUsrVariant;
			}
			if (aType < bType) {
				return -1;
			}
			if (aType > bType) {
				return 1;
			}
			return 0;
		},

		/*Function to send the whole model back to the server using a POST call.
		Please make sure all the business logic is handled on the server side [either xsjs or xsodata].
		@Params: 
		UpdtService
		UpdtServEntity*/
		onSaveTableData: function (oEvt) {
			var isXSJS = false;
			var postURI;
			var table = this.getView().byId("idBRSTableMasterVariantReponsiveDataTable");
			var varSel = this.getView().byId("idBRSTableMasterVariantSelect");
			var currVariant = varSel.getSelectedItem().data("variantData");
			var modelData = table.getModel().getObject("/");
			var updtService = currVariant.UpdtService;
			if (updtService && updtService.indexOf("xsjs") > -1) {
				isXSJS = true;
			} else if (updtService && updtService.indexOf("xsodata") > -1) {
				isXSJS = false;
			}

			if (!updtService) {
				MessageBox.alert(this.oBundle.getProperty("dataSaveErr"));
				jQuery.sap.log.error("could not find UpdtService in config");
				return;
			}

			this.getView().setBusy(true);
			if (isXSJS) {
				/*make it an xsjs call*/

				postURI = this.serviceURL + updtService;
				$.ajax({
					url: postURI,
					type: "POST",
					context: this,
					data: JSON.stringify(modelData),
					contentType: "application/json",
					success: function (oResp) {
						this.getView().setBusy(false);
						MessageBox.information(this.oBundle.getProperty("dataSaveSucc"));
						this.getTableConfig(varSel.getSelectedKey(), undefined, true);
					},
					error: function (oErr) {
						var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
						var errMessage = oErr.responseJSON;
						this.getView().setBusy(false);
						MessageBox.show(errMessage.message, {
							icon: "sap-icon://error",
							title: this.oBundle.getProperty("error"),
							actions: [MessageBox.Action.OK],
							defaultAction: MessageBox.Action.OK,
							details: errMessage.details,
							styleClass: bCompact ? "sapUiSizeCompact" : ""
						});
						jQuery.sap.log.error("Error while posting data: " + oErr);
					}
				});
			} else {
				/*default is an xsjs call*/
				var updtServEntity = currVariant.UpdtServEntity;

				if (!updtServEntity) {
					this.getView().setBusy(false);
					MessageBox.alert(this.oBundle.getProperty("dataSaveErr"));
					jQuery.sap.log.error("could not find UpdtServiceEntity in config");
					return;
				}

				postURI = updtServEntity.startsWith("/") ? updtServEntity : "/" + updtServEntity;
				var postM = new sap.ui.model.odata.ODataModel(this.serviceURL + updtService, {
					json: true,
					useBatch: true
				});

				var batchDataArr = [];
				modelData.forEach(function (modelObj) {
					batchDataArr.push(postM.createBatchOperation(postURI, "POST", modelObj));
				}, this);
				postM.addBatchChangeOperations(batchDataArr);
				postM.submitBatch($.proxy(function (oSucc) {
						this.getView().setBusy(false);
						MessageBox.information(this.oBundle.getProperty("dataSaveSucc"));
					}, this),
					$.proxy(function (oErr) {
						this.getView().setBusy(false);
						MessageBox.alert(this.oBundle.getProperty("dataSaveErr"));
						jQuery.sap.log.error("Error while posting data: " + oErr);
					}, this));
			}
		},

		/**Table specific Utility Functions**/
		checkDuplicateVariant: function (oEvt) {
			var src = oEvt.getSource();
			var variantData = this.getView().getModel("variantModel").getData();
			var currText = oEvt.getParameter("value");
			if (this._confirmVariantDialog) {
				var btns = this._confirmVariantDialog.getAggregation("buttons");
			}

			if (btns) {
				btns[0].setEnabled(true);
				btns[1].setEnabled(true);
			}
			sap.ui.getCore().byId("idBRSTableMasterVariantSaveSuperChk").setEnabled(true);
			if (!variantData || !variantData.length) {
				return;
			}
			var isVariantExisting = variantData.filter(function (variantObj) {
				return (variantObj.Type === "App") ? variantObj.AppVariantID === currText : variantObj.UsrVariantID === currText;
			}, this);

			if (isVariantExisting && isVariantExisting.length && isVariantExisting.length > 0) {
				var type = isVariantExisting[0].Type;
				var usrVariantID = isVariantExisting[0].UsrVariantID;
				if (type === "App") {
					//cannot override an app
					src.setValueState(sap.ui.core.ValueState.Error);
					src.setValueStateText("Please change the variant ID");
					//Disbale all Buttons in the save Dialog
					if (btns) {
						btns[0].setEnabled(false);
						btns[1].setEnabled(false);
					}
				} else if (type === "User" && usrVariantID === "$DEFAULT") {
					//Default Variant. User cannot save this as a Sharable Variant
					sap.ui.getCore().byId("idBRSTableMasterVariantSaveSuperChk").setEnabled(false);
				} else {
					src.setValueState(sap.ui.core.ValueState.Warning);
					src.setValueStateText("Currently overriding a Sharable Variant. Please reconsider");
				}
			}
		},

		/*Manage User Variants function*/
		onManageVariants: function (oEvt) {
			var vList = sap.ui.getCore().byId("idVariantsManage--idVariantManageTable");
			if (oEvt && oEvt.getSource() && oEvt.getSource().data("action")) {
				var action = oEvt.getSource().data("action");
				switch (action) {
				case "delete":
					this.getView().setBusy(true);
					if (this.variantsManageDialog.isOpen()) {
						this.variantsManageDialog.close();
					}
					var selectedItems = vList.getSelectedItems();
					if (selectedItems && selectedItems.length && selectedItems.length > 0) {
						var dataToSend = [],
							appId = selectedItems[0].data("variantData").AppID;
						selectedItems.forEach(function (oItem) {
							var vData = oItem.data("variantData");
							dataToSend.push({
								"AppVariantID": vData.AppVariantID,
								"Username": vData.Username,
								"UsrVariantID": vData.UsrVariantID
							});
						}, this);

						var delURL = this.serviceURL + "/BRS/HAA/services/GetConfig.xsjs?Delete&AppID=" + appId;
						var currSelectedvData = this.getView().byId("idBRSTableMasterVariantSelect").getSelectedItem().data("variantData");
						$.ajax({
							url: delURL,
							type: "POST",
							context: this,
							contentType: "application/json",
							data: JSON.stringify(dataToSend),
							success: function () {
								sap.m.MessageToast.show(this.oBundle.getProperty("varDelSuccess"));
								var variantID;
								if (currSelectedvData.Type === "User") {
									variantID = currSelectedvData.UsrVariantID;
								} else {
									variantID = currSelectedvData.AppVariantID;
								}
								this.getVariantConfig(currSelectedvData.AppID, variantID, currSelectedvData.Type);
							},
							error: function (oErr) {
								this.getView().setBusy(false);
								MessageBox.alert(this.oBundle.getProperty("err_gen"), {
									onClose: $.proxy(function () {
										var variantID;
										if (currSelectedvData.Type === "User") {
											variantID = currSelectedvData.UsrVariantID;
										} else {
											variantID = currSelectedvData.AppVariantID;
										}
										this.getVariantConfig(currSelectedvData.AppID, variantID, currSelectedvData.Type);
									}, this)
								});
							}
						});
					} else {
						this.getView().setBusy(false);
					}
					break;
				case "selectAll":
				case "deselectAll":
					var bSelect = true;
					if (action === "deselectAll") {
						bSelect = false;
						sap.ui.getCore().byId("idVariantsManage--idVariantManageSelectAll").setVisible(true);
						sap.ui.getCore().byId("idVariantsManage--idVariantManageDeSelectAll").setVisible(false);
					} else {
						sap.ui.getCore().byId("idVariantsManage--idVariantManageSelectAll").setVisible(false);
						sap.ui.getCore().byId("idVariantsManage--idVariantManageDeSelectAll").setVisible(true);
					}
					if (vList && vList instanceof sap.m.List) {
						var items = vList.getItems();
						items.forEach(function (oItem) {
							oItem.setSelected(bSelect);
						}, this);
					}
					break;
				case "close":
					if (this.variantsManageDialog.isOpen()) {
						this.variantsManageDialog.close();
					}
					break;
				default:
				}
				return;
			}

			if (!this.variantsManageDialog) {
				this.variantsManageDialog = sap.ui.xmlfragment("idVariantsManage", "brs_demo_tablemaster.fragments.UserVariantManagement", this);
				this.getView().addDependent(this.variantsManageDialog);
				this.variantsManageDialog.setModel(this.oBundle);
			}

			sap.ui.getCore().byId("idVariantsManage--idVariantManageSelectAll").setVisible(true);
			sap.ui.getCore().byId("idVariantsManage--idVariantManageDeSelectAll").setVisible(false);
			var delBtn = sap.ui.getCore().byId("idVariantsManage--idVariantManageDeleteBtn");

			this.variantsManageDialog.setBusyIndicatorDelay(0);
			this.variantsManageDialog.setBusy(true);
			if (!this.variantsManageDialog.isOpen()) {
				this.variantsManageDialog.open();
			}

			//get list of User Variants
			var varModel = this.getView().getModel("variantModel");
			if (varModel && varModel.getData() && varModel.getData().length > 0) {
				var uvData = [];
				uvData = varModel.getData().filter(function (vData) {
					return (vData && vData.Type === "User" && vData.Username !== "_#SUPER");
				}, this);
				if (uvData.length > 0) {
					delBtn.setEnabled(true);
				} else {
					delBtn.setEnabled(false);
				}
				var uvModel = new JSONModel();
				uvModel.setData(uvData, false);
				this.getView().setModel(uvModel, "uvModel");
				uvModel.refresh(true);
				this.variantsManageDialog.setBusy(false);
			} else {
				this.variantsManageDialog.setBusy(false);
			}
		}
	});
});