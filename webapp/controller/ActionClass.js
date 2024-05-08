sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/odata/ODataModel",
	"sap/m/Dialog",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/m/List",
	"brs_demo_tablemaster/utilities/Utilities"

], function (JSONModel, ODataModel, Dialog, MessageBox, MessageToast, List, Utilities) {
	return {

		actionBtnSetup: function (customData, listItem, oController, dTblLI) {
			var actionBtnInfo, actionData;
			this.oController = oController;
			this.dTblLI = dTblLI;
			var fieldData = customData.actionBtn;
			var variantData = customData.variantData;
			if (fieldData && fieldData.hasOwnProperty("ButtonPar")) {
				actionBtnInfo = fieldData.ButtonPar;
			}
			if (actionBtnInfo) {
				actionData = JSON.parse(actionBtnInfo);
			}

			switch (actionData.action.toLowerCase()) {
			case "document":
				this.createDocumentDialog(listItem, variantData, fieldData, actionData);
				break;
			case "case":
				this.checkCurrentUserBE();
				this.createCaseDialog(listItem, variantData, fieldData, actionData);
				break;
			case "longtext":
				this.createSuperComments(listItem, variantData, fieldData, actionData);
				break;
			case "download":
				this.downloadPDF(dTblLI, variantData, fieldData, actionData);
				break;
			default:
			}
		},

		downloadPDF: function (listItem, variantData, fieldData, actionData) {
			var retData = actionData.RetData;
			var downloadURL = "";
			if (retData && retData.VariantFields) {
				var variantFieldArr = retData.VariantFields.split(",");
				variantFieldArr.forEach(function (variantFieldObj) {
					downloadURL += variantFieldObj + "=" + actionData[variantFieldObj] + "&";
				}, this);
			}

			//Add the security details
			downloadURL += "SecurityAppID=" + actionData.SecurityAppID + "&SecurityAppVariantID=" + actionData.SecurityAppVariantID + "&";

			//Get the document ID
			//Change strucure to send all the filers as part of a single param
			var documentFilter = "";
			var documentIDArr = retData.DocumentID.split(",");
			documentIDArr.forEach(function (oDocObj) {
				documentFilter += oDocObj + " eq '" + listItem.getModel().getProperty(listItem.getBindingContextPath() + "/" + oDocObj) + "' and ";
			}, this);
			// var documentID = listItem.getModel().getProperty(listItem.getBindingContextPath() + "/" + retData.DocumentID);
			if (!documentFilter) {
				MessageBox.alert("No Document found for download");
				return;
			}

			//remove the last and
			var lastIdxOfAnd = documentFilter.lastIndexOf("and");
			if (lastIdxOfAnd > -1) {
				documentFilter = documentFilter.substring(0, lastIdxOfAnd).trim();
			}

			//Download the PDF
			downloadURL = downloadURL + "DocFilter=" + documentFilter;
			//Add the DocumentID
			downloadURL = downloadURL + "&DocumentID='" + listItem.getModel().getProperty(listItem.getBindingContextPath() + "/" + retData.DocumentID) + "'";

			var service = actionData.Service;
			if (!service) {
				MessageBox.alert("No Attachment Service. Please check the config");
				return;
			}
			window.open(this.oController.serviceURL + service + "?" + downloadURL);
		},

		createDialog: function (title) {
			var stretch = sap.ui.Device.system.desktop ? false : true;
			var dialog = new Dialog({
				title: title,
				stretch: stretch,
				buttons: [
					new sap.m.Button({
						text: this.oController.oBundle.getProperty("close"),
						press: function (oEvt) {
							dialog.close();
						}
					})
				]
			});
			return dialog;
		},

		createSuperComments: function (listItem, variantData, fieldData, actionData) {
			/*Read comments from QRY_LONG_TEXT*/
			var param = actionData.param,
				objectType = actionData.objectType,
				objectSubtype = actionData.objectSubtype,
				filterValue;
			if (!param || !listItem) {
				return;
			}

			var actDialog = this.createDialog(this.oController.oBundle.getProperty("comments"));
			actDialog.setBusyIndicatorDelay(0);

			//get the Param value
			if (!param || !objectType || listItem && listItem instanceof sap.m.ColumnListItem) {
				filterValue = listItem.getModel().getData()[listItem.getBindingContextPath().substr(1)][param];
			}
			if (!filterValue) {
				return;
			}

			if (!actDialog.isOpen()) {
				actDialog.open();
			}
			actDialog.setBusy(true);

			var allCommsModel = new ODataModel(this.oController.serviceURL + this.oController.basePath + "/HAA/services/LongText.xsodata", {
				json: true,
				defaultCountMode: sap.ui.model.odata.CountMode.None
			});

			var allCommsFilter = [
				new sap.ui.model.Filter({
					path: "OBJECTKEY",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: filterValue
				})
				/*Change By Abdel*/
				/*new sap.ui.model.Filter({
					path: "TextType",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: objectType
				})*/
			];

			if (objectSubtype) {
				allCommsFilter.push(new sap.ui.model.Filter({
					path: "TextSubTypeID",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: objectSubtype
				}));
			}

			var aCommList = new List({
				inset: false,
				growing: true
			});
			aCommList.setModel(allCommsModel);
			actDialog.addContent(aCommList);
			if (!this.longTextTemplate) {
				this.longTextTemplate = sap.ui.xmlfragment("brs_demo_tablemaster.fragments.LongText");
			}

			var oTemplate = new sap.m.CustomListItem();
			oTemplate.addContent(this.longTextTemplate);
			// var oTemplate = new sap.m.StandardListItem({
			// 	type: "Inactive",
			// 	title: "{LONGTEXT}",
			// 	icon: "sap-icon://comment",
			// 	description: "{path: 'TDLDATE', type: 'sap.ui.model.type.Date'}"
			// });
			// .addStyleClass("actionCaseCommentsLI");

			aCommList.bindAggregation("items", {
				// path: "/LongTextParamsParameters(WO_NUMBER='" + filterValue + "')/Results",
				path: "/LongText",
				template: oTemplate,
				filters: [new sap.ui.model.Filter({
					filters: allCommsFilter,
					and: true
				})],
				sorter: [new sap.ui.model.Sorter({
						path: "TDLDATE",
						descending: true
					}),
					new sap.ui.model.Sorter({
						path: "TDLTIME",
						descending: true
					})
				]
			});
			actDialog.setBusy(false);
		},

		createLongTextDialog: function (listItem, variantData, fieldData, actionData) {
			//Fetch Long Texts for Object
			var objectType = actionData.objectType,
				// param = actionData.param,
				name,
				ltModel = this.oController.getView().getModel("longText");
			if (!objectType || !listItem || !listItem instanceof sap.m.ColumnListItem) {
				return;
			}
			var actDialog = this.createDialog(this.oController.oBundle.getProperty("longText"));
			actDialog.setStretch(false);
			actDialog.setBusyIndicatorDelay(0);
			actDialog.setBusy(true);
			actDialog.open();

			//get the param value
			var oModel = listItem.getModel();
			var bindingPath = listItem.getBindingContextPath().substr("1");
			var oData = oModel.getData()[bindingPath];
			var objTypeInfo = ltModel.getData()[objectType];
			name = oData[objTypeInfo.paramField1];

			var dModel = new ODataModel(this.oController.sapServiceURL + "/sap/opu/odata/sap/ZSERVICEREQUESTDOCS_SRV", {
				json: true
			});

			var nameFilter, idFilter;
			if (objectType && objectType.toLowerCase() === "reobject") {
				nameFilter = new sap.ui.model.Filter({
					path: "Name2",
					operator: "EQ",
					value1: name
				});

				if (actionData.reid) {
					idFilter = new sap.ui.model.Filter({
						path: "Id",
						operator: "EQ",
						value1: actionData.reid
					});
				}
			} else {
				nameFilter = new sap.ui.model.Filter({
					path: "Name",
					operator: "EQ",
					value1: name
				});

				idFilter = new sap.ui.model.Filter({
					path: "Id",
					operator: "EQ",
					value1: objTypeInfo.id
				});
			}

			var longTextFilterArr = [idFilter,
				new sap.ui.model.Filter({
					path: "Object",
					operator: "EQ",
					value1: objTypeInfo.object
				}),
				nameFilter
			];

			if (objectType && objectType.toLowerCase() === "reobject") {
				longTextFilterArr.push(new sap.ui.model.Filter({
					path: "Name",
					operator: "EQ",
					value1: "9800"
				}));
			} else if (objectType && objectType.toLowerCase() === "equipmentpermits") {
				if (!this.dTblLI) {
					actDialog.setBusy(false);
					return;
				}
				var permitsID = this.dTblLI.getModel().getData(this.dTblLI.getBindingContextPath()).PermitsID;
				if (!permitsID) {
					actDialog.setBusy(false);
					return;
				}
				longTextFilterArr.push(new sap.ui.model.Filter({
					path: "Name2",
					operator: "EQ",
					value1: permitsID
				}));
			}

			var ltFilter = new sap.ui.model.Filter({
				filters: longTextFilterArr,
				and: true
			});

			var lTextlist = new List({
				inset: false,
				growing: true
			});
			lTextlist.setModel(dModel);
			actDialog.addContent(lTextlist);

			var oTemplate = new sap.m.CustomListItem({
				content: [
					new sap.m.Text({
						width: "auto",
						text: "{Text}",
						wrapping: true
					}).addStyleClass("sapUiSmallMargin")
				]
			});

			lTextlist.bindAggregation("items", {
				path: "/ReadText",
				template: oTemplate,
				filters: [ltFilter]
			});
			actDialog.setBusy(false);

		},

		/*Reads from /BRS/HAA/models/QRY_LONG_TEXT. Merged code for long text and case and Interactions */
		createCaseDialog: function (listItem, variantData, fieldData, actionData) {
			var param = actionData.param,
				filterValue;
			var interactionType = actionData.interactionType;
			var objectType = actionData.objectType;
			var referenceObjects = actionData.referenceObjects;
			var activitySubType = actionData.activitySubType || undefined;

			if (param && interactionType && objectType) {
				/*Case and Interactions*/
				var actDialog = this.createDialog(this.oController.oBundle.getProperty("ci")); //fieldData.FieldDescription
				actDialog.setBusyIndicatorDelay(0);
				// actDialog.setContentWidth("640px");
				// actDialog.setContentHeight("480px");

				//get the Param value
				if (listItem && listItem instanceof sap.m.ColumnListItem) {
					filterValue = listItem.getModel().getData()[listItem.getBindingContextPath().substr(1)][param];
				}
				if (!filterValue) {
					return;
				}

				if (!actDialog.isOpen()) {
					actDialog.open();
				}

				/*Multiple Reference Object Types suported
				has to be "comma" separated in the config for objectType
				lookup reference object TypeID using the fieldname
				*/
				var dataObj = [];
				//Create a valid Reference Objects Array to be passed
				if (referenceObjects && referenceObjects.length > 0) {
					var refObjsArr = referenceObjects.split(",");
					this.getReferenceDatasetup(refObjsArr, $.proxy(function (oData) {
							oData.results.forEach(function (dtObj) {
								var refID = listItem.getModel().getData()[listItem.getBindingContextPath().substr(1)][dtObj.FieldName];
								dataObj.push({
									"ReferenceObjectID": refID,
									"ReferenceObjectTypeID": dtObj.ReferenceObjectTypeID
								});
							}, this);
						}, this),
						$.proxy(function (oErr) {
							actDialog.setBusy(false);
							jQuery.sap.log.error(oErr.responseText);
							MessageBox.alert(sap.ui.getCore().getModel("i18n").getProperty("err_gen"));
						}, this));
				}

				var ciModel = new ODataModel(this.oController.serviceURL + "/BRS/HAA/services/CaseAndInt.xsodata", {
					json: true
				});

				/*Button for new Comment or question*/
				if (interactionType && interactionType.toLowerCase() === "question") {
					var caseQuestionBtn = new sap.m.Button({
						text: this.oController.oBundle.getProperty("newQuestion"),
						icon: "sap-icon://add"
					});
					caseQuestionBtn.attachPress({
						dataObj: dataObj,
						InteractionType: "question",
						activitySubType: activitySubType
					}, this.onInteractionCreate.bind(this));
					actDialog.insertButton(caseQuestionBtn, 0);
				} else if (interactionType && interactionType.toLowerCase() === "comment") {

					var caseCommentBtn = new sap.m.Button({
						text: this.oController.oBundle.getProperty("newComment"),
						icon: "sap-icon://add"
					});
					caseCommentBtn.attachPress({
						dataObj: dataObj,
						InteractionType: "Comment",
						activitySubType: activitySubType
					}, this.onInteractionCreate.bind(this));
					actDialog.insertButton(caseCommentBtn, 1);
				}

				var ciFilterArr = [new sap.ui.model.Filter({
					path: "ReferenceObjectID",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: filterValue
				}), new sap.ui.model.Filter({
					path: "ReferenceObjectTypeID",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: objectType
				})];

				if (interactionType && interactionType.toLowerCase() === "question") {
					ciFilterArr.push(new sap.ui.model.Filter({
						filters: [
							new sap.ui.model.Filter({
								path: "ActivityTypeID",
								operator: sap.ui.model.FilterOperator.EQ,
								value1: interactionType
							}),
							new sap.ui.model.Filter({
								path: "ActivityTypeID",
								operator: sap.ui.model.FilterOperator.EQ,
								value1: "Answer"
							})
						],
						and: false
					}));
				} else {
					ciFilterArr.push(new sap.ui.model.Filter({
						path: "ActivityTypeID",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: interactionType
					}));
				}
				if (activitySubType && activitySubType.toLowerCase() === "risk_comment") {
					ciFilterArr.push(new sap.ui.model.Filter({
						path: "ActivitySubTypeID",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: "Risk_Comment"
					}));
				} else if (activitySubType) {
					ciFilterArr.push(new sap.ui.model.Filter({
						path: "ActivitySubTypeID",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: activitySubType
					}));
				}
				var ciFilters = new sap.ui.model.Filter({
					filters: ciFilterArr,
					and: true
				});

				var interactionList = new List({
					inset: false,
					includeItemInSelection: true,
					growing: true
				});
				interactionList.setModel(ciModel, "ciModel");
				this.oController.getView().setModel(ciModel, "ciModel");
				actDialog.addContent(interactionList);

				var oTemplate = new sap.m.StandardListItem({
					type: "Inactive",
					title: "{ciModel>Comments}",
					description: "{ciModel>CreatedBy}",
					info: "{path: 'ciModel>CreatedDate', type:'sap.ui.model.type.Date'}"
				}).addStyleClass("actionCaseCommentsLI");
				oTemplate.bindProperty("icon", {
					path: "ciModel>ActivityTypeID",
					formatter: function (oValue) {
						var iconStr = "sap-icon://comment";
						if (oValue && oValue.toLowerCase() === "question") {
							iconStr = "sap-icon://question-mark";
						} else if (oValue && oValue.toLowerCase() === "answer") {
							iconStr = "sap-icon://response";
						}
						return iconStr;
					}
				});

				interactionList.bindAggregation("items", {
					path: "ciModel>/Comments",
					template: oTemplate,
					filters: [ciFilters],
					sorter: [new sap.ui.model.Sorter({
							path: "CaseID",
							descending: false
						}),
						new sap.ui.model.Sorter({
							path: "ActivityID",
							descending: false
						})
					]
				});
			} else {
				MessageBox.alert(this.oConroller.oBundle.getProperty("caseActionGreErr"));
			}
		},

		getReferenceDatasetup: function (refObjsArr, succcallback, errcallback) {
			var filterToPass = [];
			//filter preparation
			if (refObjsArr && refObjsArr.length && refObjsArr.length > 0) {
				refObjsArr.forEach(function (refObj) {
					filterToPass.push(new sap.ui.model.Filter({
						path: "FieldName",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: refObj
					}));
				}, this);
			}

			var refDataModel = new ODataModel(this.oController.serviceURL + "/BRS/HAA/services/CaseAndInt.xsodata", {
				json: true
			});
			refDataModel.read("ReferenceObjectType", {
				async: false,
				filters: [new sap.ui.model.Filter({
					filters: filterToPass,
					and: false
				})],
				success: succcallback.bind(this),
				error: errcallback.bind(this)
			});
		},

		/*Create Comments and Questions from the app
		@Params
		 -ReferenceObjectID: String
		 - ReferenceObjectType: String
		 - IneractionType: String*/
		onInteractionCreate: function (btnEvt, oData) {
			if (this.oController.isParentBE) {
				MessageBox.alert(this.oController.oBundle.getProperty("beerr"));
				return;
			}
			this.rrRating = undefined;
			if (!oData) {
				return;
			}
			var interactionDialog = this.createDialog(this.oController.oBundle.getProperty("create"));
			interactionDialog.setIcon("sap-icon://add");
			interactionDialog.insertButton(new sap.m.Button({
				text: this.oController.oBundle.getProperty("save"),
				icon: "sap-icon://save",
				press: $.proxy(function () {
					this.createCI(interactionDialog, oData, btnEvt);
				}, this)
			}));
			if (!this.diagContent) {
				this.diagContent = sap.ui.xmlfragment(this.oController.getView().getId(), "brs_demo_tablemaster.fragments.CreateInteraction", this);
			}
			interactionDialog.addContent(this.diagContent);
			if (oData.InteractionType && oData.InteractionType.toLowerCase() === "comment") {
				sap.ui.core.Fragment.byId(this.oController.getView().getId(), "idDOAL").setVisible(false);
				this.diagContent.getItems()[0].setPlaceholder(this.oController.oBundle.getProperty("enterComment"));
				this.diagContent.getItems()[0].setValue("");
			} else if (oData.InteractionType && oData.InteractionType.toLowerCase() === "question") {
				//Enable the DOA Part
				var doaBox = sap.ui.core.Fragment.byId(this.oController.getView().getId(), "idDOAL");
				doaBox.setVisible(true);
				this.loadDOA(oData.InteractionType);
				this.diagContent.getItems()[0].setPlaceholder(this.oController.oBundle.getProperty("enterQuestion"));
				this.diagContent.getItems()[0].setValue("");
			}

			if (oData.activitySubType && oData.activitySubType.toLowerCase() === "risk_comment") {
				var combobox = this.diagContent.getItems()[2];
				combobox.setVisible(true);
				var rrModel = new ODataModel(this.oController.serviceURL + "/BRS/Architect_DataModel/Query/CRE/services/QRY_LEASE_ACTIVITY.xsodata", {
					json: true
				});
				if (combobox && combobox instanceof sap.m.ComboBox) {
					combobox.setModel(rrModel);
					//Event Attach
					combobox.attachSelectionChange(function (oEvt) {
						var selItem = oEvt.getParameter("selectedItem");
						if (selItem && selItem instanceof sap.ui.core.Item) {
							this.rrRating = selItem.getText();
						}
					}, this);

					//Bind Data
					var template = combobox.getBindingInfo("items").template;
					combobox.bindAggregation("items", {
						path: "/RISK_RATING",
						template: template
					});
				}
			}

			if (!interactionDialog.open()) {
				interactionDialog.open();
			}
		},

		createCI: function (ciCreateDialog, activityData, oSrcEvt) {
			/*Use CICFastCreate.xsjs to create.*/
			var comments = ciCreateDialog.getContent()[0].getItems()[0].getValue();
			if (!comments) {
				ciCreateDialog.getContent()[0].getItems()[0].setValueState("Error");
				return;
			}

			var dataToSend = {
				"Case": [{
					"Type": (activityData && activityData.InteractionType && activityData.InteractionType === "question") ? "Question" : "Comment",
					"Comments": comments,
					AssignedObjects: activityData.dataObj
				}]
			};

			if (activityData && activityData.activitySubType) {
				dataToSend.Case[0].ActivitySubTypeID = activityData.activitySubType;
				if (activityData.activitySubType.toLowerCase() === "risk_comment") {
					var cmbx = ciCreateDialog.getContent()[0].getItems()[2];
					if (cmbx && cmbx instanceof sap.m.ComboBox) {
						var rrComment = cmbx.getSelectedItem().getText();
						this.createRiskRating(dataToSend, rrComment);
					}
				}
			}

			if (activityData && activityData.InteractionType && activityData.InteractionType.toLowerCase() === "question") {
				var assignedTo = sap.ui.core.Fragment.byId(this.oController.getView().getId(), "idDOA").getSelectedKey();
				dataToSend.Case[0].AssignedTo = assignedTo;
			}

			//Check for assigned Objects
			if (!activityData.dataObj || !activityData.dataObj.length || activityData.dataObj.length <= 0) {
				MessageBox.alert(this.oController.oBundle.getProperty("err_gen"));
				return;
			}
			ciCreateDialog.setBusy(true);
			$.ajax({
				url: this.oController.serviceURL + "/BRS/HAA/services/CICFastCreate.xsjs",
				type: "POST",
				data: JSON.stringify(dataToSend),
				context: this,
				contentType: "application/json",
				success: function (oSucc) {
					ciCreateDialog.setBusy(false);
					MessageToast.show(this.oController.oBundle.getProperty("caseSucc"));
					ciCreateDialog.close();
					this.oController.getView().getModel("ciModel").refresh(true);
				},
				error: function (oErr) {
					ciCreateDialog.setBusy(false);
					MessageBox.alert(this.oController.oBundle.getProperty("err_gen"));
				}
			});
		},

		loadDOA: function (interactionType) {
			var doaBox = sap.ui.core.Fragment.byId(this.oController.getView().getId(), "idDOA");
			if (!doaBox || !doaBox instanceof sap.m.Select || !interactionType) {
				return;
			}
			doaBox.setBusyIndicatorDelay(0);
			doaBox.setVisible(true);
			var doaModel = new ODataModel(this.oController.serviceURL + "/BRS/HAA/services/CaseAndInt.xsodata", {
				json: true
			});
			doaBox.setModel(doaModel);
			var oTemplate = doaBox.getBindingInfo("items").template;
			var oFilters = new sap.ui.model.Filter({
				path: "CaseType",
				operator: "EQ",
				value1: jQuery.sap.charToUpperCase(interactionType, 0)
			});

			doaBox.bindAggregation("items", {
				path: "/DOA",
				template: oTemplate,
				filters: [oFilters],
				sorter: [new sap.ui.model.Sorter({
					path: "UserID",
					descending: false
				})]
			});
		},

		createRiskRating: function (dataToSend, rrComment) {
			var rrData = JSON.parse(JSON.stringify(dataToSend));
			rrData.Case[0].Comments = rrComment;
			rrData.Case[0].ActivitySubTypeID = "Risk_Rating";
			$.ajax({
				url: this.oController.serviceURL + "/BRS/HAA/services/CICFastCreate.xsjs",
				type: "POST",
				data: JSON.stringify(rrData),
				context: this,
				contentType: "application/json",
				success: function (oSucc) {
					var selectedKey = this.oController.getView().byId("idBRSTableMasterVariantSelect").getSelectedKey();
					this.oController.getTableConfig(selectedKey, false);
				},
				error: function (oErr) {
					// ciCreateDialog.setBusy(false);
					MessageBox.alert(this.oController.oBundle.getProperty("err_gen"));
				}
			});
		},

		createDocumentDialog: function (listItem, variantData, fieldData, actionData) {
			this.updtFinishedCalled = undefined;
			sap.ui.core.BusyIndicator.show(0);
			var param = actionData.param;
			// var docType = actionData.docType || null;
			var filter;
			var actDialog = this.createDialog(fieldData.FieldDescription);
			actDialog.setBusyIndicatorDelay(0);
			actDialog.setBusy(true);

			if (!actDialog.isOpen()) {
				actDialog.open();
			}

			actDialog.attachAfterOpen(function () {
				sap.ui.core.BusyIndicator.hide();
			}, this);

			if (!param) {
				actDialog.setBusy(false);
			} else {
				/*Get the value for the param*/
				if (listItem && listItem instanceof sap.m.ColumnListItem) {
					filter = listItem.getModel().getData()[listItem.getBindingContextPath().substr(1)][param];
					//Change for removing the company code for Financial Documents
					/*	if (param && param.toLowerCase() && param.toLowerCase() === "documentnumber") {
							filter = filter.substr(filter.length - 10);
						}*/

					actDialog.setVerticalScrolling(false);
					// actDialog.setContentHeight("600px");
					var toolbar = new sap.m.Toolbar({
						width: "100%",
						content: [
							new sap.m.Toolbar({
								width: "100%",
								content: [
									new sap.m.ToolbarSpacer(),
									new sap.m.Button({
										icon: "sap-icon://full-screen",
										customData: [
											new sap.ui.core.CustomData({
												key: "KMJTData",
												value: {
													// "docType": docType,
													"objectID": filter
												}
											})
										],
										press: this.jumpToKM.bind(this)
									})
								]
							})
						]
					});
					/*Check if toolbar needs to be added or not
					 *Check is based on semantic object check
					 */
					Utilities.checkNavigationIntent("brscreapknowledgemanagement", "Display", this.oController,
						$.proxy(function (oRetValue) {
							if (oRetValue) {
								actDialog.setSubHeader(toolbar);
							}
						}, this));

					//Create table content for the Dialog
					this.kmTable = new sap.m.Table({
						width: "100%",
						inset: true,
						growing: true,
						growingThreshold: 100
					}).addStyleClass("persoTableStyle");
					var sc = new sap.m.ScrollContainer({
						width: "auto",
						height: "100%",
						vertical: true,
						horizontal: false,
						content: [this.kmTable]
					});
					actDialog.addContent(sc);
					/*set Height of the sc*/

					this.kmTable.setBusyIndicatorDelay(0);

					if (!filter) {
						actDialog.setBusy(false);
						return;
					}

					//Get the additonal Filters for more precise FIltering
					/*14-06-2018: Change for Accomodating RE Invoice Documents*/
					var addtionalFilters;
					if (actionData && actionData.additionalFilter && actionData.additionalFilter.length && actionData.additionalFilter.length > 0) {
						addtionalFilters = this.getAddtionalFilterData(variantData, actionData, actionData.additionalFilter, filter);
					}

					//check for Dependent Info exists for the current config
					if (actionData.dependent) {
						//get the dependent Information
						this.getDependentObjectInfo(actionData, filter, false, $.proxy(function (oData) {
								if (oData && oData.results && oData.results.length > 0) {
									////
									filter = oData.results[0][actionData.dependentParam];
								} else {
									actDialog.setBusy(false);
									filter = undefined;
								}
							}, this),
							$.proxy(function (oErr) {
								actDialog.setBusy(false);
								filter = undefined;
							}, this));
					}

					if (!filter) {
						actDialog.setBusy(false);
						filter = undefined;
						return;
					}

					this.kmTemplate = new sap.m.ColumnListItem();
					var columns = [{
						"columnName": "docType",
						"binding": "DocumentTypeDesc",
						"type": "text"
					}, {
						"columnName": "description",
						"binding": "DocumentDescription",
						"type": "text"
					}, {
						"columnName": "createdDate",
						"binding": "CreatedOn",
						"type": "date"
					}, {
						"columnName": "Document",
						"binding": "",
						"type": "button"
					}];

					columns.forEach(function (col) {
						this.kmTable.addColumn(new sap.m.Column({
							hAlign: "Center",
							vAlign: "Middle",
							header: [
								new sap.m.Text({
									width: "100%",
									text: this.oController.oBundle.getProperty(col.columnName)
								})
							]
						}));

						//Add binding
						if (col.type === "date") {
							this.kmTemplate.addCell(new sap.m.DatePicker({
								editable: false,
								width: "100%",
								textlign: "Center",
								value: "{path:'" + col.binding + "' ,type:'sap.ui.model.type.Date', formatOptions:{pattern: 'dd/MM/YYYY'}}"
							}));
						} else if (col.type === "button") {
							this.kmTemplate.addCell(new sap.m.Button({
								icon: "sap-icon://document-text",
								customData: [new sap.ui.core.CustomData({
									key: "originals",
									value: "{}"
								})],
								press: this.onKMOriginalView.bind(this)
							}));
						} else {
							this.kmTemplate.addCell(new sap.m.Text({
								width: "100%",
								textAlign: "Center",
								text: "{" + col.binding + "}"
							}));
						}
					}, this);

					this.kmTable.attachUpdateFinished(function (oEvt) {
						/*Do Manual Filtering of Documents for additonal Filters*/
						if (!this.updtFinishedCalled) {
							if (addtionalFilters && addtionalFilters.length && addtionalFilters.length > 0) {
								var clientFltrArr = [];
								addtionalFilters.forEach(function (oFltr) {
									clientFltrArr.push(new sap.ui.model.Filter({
										path: oFltr.fieldname,
										operator: sap.ui.model.FilterOperator.EQ,
										value1: oFltr.value || ""
									}));
								}, this);

								var binding = this.kmTable.getBinding("items");
								binding.filter(clientFltrArr, "Application");
								// binding.refresh(true);
							}
						}

						this.updtFinishedCalled = true;
						actDialog.setBusy(false);

						var dialogC = this.kmTable.getParent().getParent().getContent();
						if (dialogC) {
							var jd = jQuery.sap.byId(dialogC[0].getId());
							var height = jd.height();
							this.kmTable.getParent().getParent().setContentHeight(height + "px");
						}

					}, this);

					/*call Knowledge Management Backend to get documents
					@Params:
					 - ObjectID
					 - DocType if available
					*/
					// var kmURL = this.oController.sapServiceURL + "/sap/opu/odata/sap/ZKMDOCUMENTS_SRV";
					var kmURL = this.oController.serviceURL + "/BRS/Architect_DataModel/Query/DMS/services/QRY_DMS_DOCUMENT.xsodata";
					var kmModel = new ODataModel(kmURL, {
						json: true,
						defaultCountMode: sap.ui.model.odata.CountMode.None,
						// defaultOperationMode: sap.ui.model.odata.OperationMode.Auto
					});
					kmModel.setDefaultBindingMode(sap.ui.model.BindingMode.OneWay);
					this.kmTable.setModel(kmModel);

					var fltrArr = [new sap.ui.model.Filter({
						path: "LinkedObjectKey",
						operator: sap.ui.model.FilterOperator.EQ,
						value1: filter
					})];
					if (addtionalFilters && addtionalFilters.length && addtionalFilters.length > 0) {
						addtionalFilters.forEach(function (oFltr) {
							fltrArr.push(new sap.ui.model.Filter({
								path: oFltr.fieldname,
								operator: sap.ui.model.FilterOperator.EQ,
								value1: oFltr.value || ""
							}));
						}, this);
					}

					var finalFilter;
					if (fltrArr && fltrArr.length > 1) {
						finalFilter = new sap.ui.model.Filter({
							filters: fltrArr,
							and: true
						});
					} else {
						finalFilter = fltrArr[0];
					}
					var mParams = {
						path: "/DocumentQuerySet",
						template: this.kmTemplate,
						filters: [finalFilter]
					};
					this.kmTable.bindAggregation("items", mParams);
					actDialog.setBusy(false);
				}
			}
		},

		getAddtionalFilterData: function (variantData, actionData, additionalFilters, filter) {
			//get value for each fieldValueType='Query'
			var retArr = JSON.parse(JSON.stringify(additionalFilters));

			additionalFilters.forEach(function (oFltr, idx) {
				var value;
				if (oFltr.fieldValueType && oFltr.fieldValueType.toLowerCase() && oFltr.fieldValueType.toLowerCase() !== "fixed") {
					//get the value for the Field
					var url = this.oController.serviceURL + oFltr.additionalFieldService + "/" + oFltr.additionalFieldEntity + "?$filter=" +
						actionData.param +
						" eq '" + filter + "'&$select=" + oFltr.fieldRef + "&$top=1&$format=json";
					$.ajax({
						url: url,
						method: "GET",
						async: false,
						context: this,
						contentType: "application/json",
						success: function (oData) {
							value = oData.d.results[0][oFltr.fieldRef];
							if (value) {
								retArr[idx].value = value;
							}
						}
					});
				} else {
					//fixed value
					retArr[idx].value = oFltr.fieldValue;
				}
			}, this);

			return retArr;
		},

		getDependentObjectInfo: function (actData, objVal, basync, successCallback, errCallback) {
			//has to be a odata service
			if (!actData.dependentService || !actData.dependentParam || !actData.dependentEntity) {
				return;
			}
			var url = this.oController.serviceURL + actData.dependentService;
			var oDModel = new ODataModel(url, {
				json: true
			});
			/*Filter on more than just one parameter. For multiple operations*/
			var depFilter = [];
			if (actData.dependentFilters && actData.dependentFilters.length && actData.dependentFilters.length > 0) {
				var lineItem = this.dTblLI;
				actData.dependentFilters.forEach(function (depFltrObj) {
					var value1 = lineItem.getModel().getProperty(lineItem.getBindingContextPath() + "/" + depFltrObj.Fieldname);
					if (value1) {
						depFilter.push(new sap.ui.model.Filter({
							path: depFltrObj.Fieldname,
							operator: sap.ui.model.FilterOperator.EQ,
							value1: value1
						}));
					}
				}, this);
			}

			var flFilter;
			if (depFilter && depFilter.length > 0) {
				depFilter.push(new sap.ui.model.Filter({
					path: actData.param,
					operator: "EQ",
					value1: objVal
				}));
				flFilter = new sap.ui.model.Filter({
					filters: depFilter,
					and: true
				});
			} else {
				flFilter = new sap.ui.model.Filter({
					path: actData.param,
					operator: "EQ",
					value1: objVal
				});
			}
			// var selectstr = actData.dependentParam ? actData.dependentParam : null;
			var bindParams = {
				async: (basync !== undefined || basync !== null) ? basync : true,
				urlParameters: {
					$select: actData.dependentParam
				},
				filters: [flFilter],
				success: successCallback,
				error: errCallback
			};
			oDModel.read("/" + actData.dependentEntity, bindParams);
		},

		onKMOriginalView: function (oEvt) {
			var oSrc = oEvt.getSource();
			if (oSrc && oSrc instanceof sap.m.Button) {
				var docInfo = oSrc.data("originals");
				var originalsURI = this.oController.sapServiceURL + "/sap/opu/odata/sap/ZKMDOCUMENTS_SRV/DocumentQuerySet(DocumentType='" +
					//var originalsURI = this.oController.serviceURL +
					//	"/BRS/Architect_DataModel/Query/DMS/services/QRY_DMS_DOCUMENT.xsodata/DocumentQuerySet(DocumentType='" +
					docInfo.DocumentType +
					"',DocumentNumber='" + docInfo.DocumentNumber + "',DocumentVersion='" + docInfo.DocumentVersion + "')/Original";
				if (originalsURI) {
					$.ajax({
						url: originalsURI + "?$format=json",
						type: "GET",
						context: this,
						contentType: "application/json",
						success: function (data) {
							if (data && data.d.results && data.d.results[0] && data.d.results[0].__metadata && data.d.results[0].__metadata.media_src) {
								var downloadURI = this.oController.sapServiceURL + "/sap/opu/odata/sap/ZKMDOCUMENTS_SRV/Originals(DocumentType='" + docInfo
									.DocumentType +
									"',DocumentNumber='" + docInfo.DocumentNumber + "',DocumentVersion='" + docInfo.DocumentVersion + "')/$value";
								window.open(downloadURI);
							} else {
								MessageBox.alert(this.controller.oBundle.getProperty("kmActDocErr"));
							}
						},
						error: function (oErr) {
							MessageBox.alert(this.controller.oBundle.getProperty("kmActDocErr"));
						}
					});
				} else {
					//Hardcoded
					MessageBox.information(this.controller.oBundle.getProperty("kmActDocErr"));

				}
			}
		},

		jumpToKM: function (oEvt) {
			var src = oEvt.getSource(),
				jtData = src.data("KMJTData");

			if (sap.ushell) {
				/*Navigate*/
				var crossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
				var sIntent = "#brscreapknowledgemanagement-Display";
				var oDeferred = crossAppNavigator.isIntentSupported([sIntent], this.oController.getOwnerComponent());
				oDeferred.done($.proxy(function (oIntentSupported) {
					if (oIntentSupported && oIntentSupported[sIntent] && oIntentSupported[sIntent]["supported"] === true) {
						sap.ui.core.BusyIndicator.show(0);
						//Save the Filters before navigating to target.
						var targetObject = {
							semanticObject: "",
							action: ""
						};

						var trgObj = sIntent.split("-");
						targetObject.semanticObject = trgObj[0].substr(1, trgObj[0].length);
						targetObject.action = trgObj[1];
						var paramsToSend = jtData;

						var href = (crossAppNavigator && crossAppNavigator.hrefForExternal({
							target: targetObject,
							params: paramsToSend
						})) || "";
						crossAppNavigator.toExternal({
							target: {
								shellHash: href
							}
						});
					} else {
						sap.ui.core.BusyIndicator.hide();
						MessageBox.alert(this.controller.oBundle.getProperty("navNotPossible"));
					}
				}, this));

			} else {
				MessageBox.alert(this.controller.oBundle.getProperty("navNotPossible"));
			}
		},

		/*Function to check if user's BE is Parent BE or Child*/
		checkCurrentUserBE: function () {
			var uri = this.oController.serviceURL + "/BRS/HAA/services/GetConfig.xsjs?checkbe";
			$.ajax({
				url: uri,
				method: "GET",
				context: this,
				contentType: "application/json",
				success: function (resp) {
					this.oController.isParentBE = resp.isParentBE;
				}
			});
		},
	};
});