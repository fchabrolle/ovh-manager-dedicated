angular.module("UserAccount").controller("UserAccountAdvancedController", [
    "UserAccount.services.Infos",
    "Alerter",
    "$translate",
    function (userAccountServiceInfos, Alerter, $translate) {
        "use strict";

        this.isLoadingDeveloperMode = false;

        this.$ngInit = () => {
            this.isLoadingDeveloperMode = true;
            userAccountServiceInfos
                .getDeveloperMode()
                .then((developmentMode) => {
                    this.developmentMode = developmentMode;
                })
                .finally(() => {
                    this.isLoadingDeveloperMode = false;
                });
        };

        this.updateDevelopmentMode = () => {
            this.isLoadingDeveloperMode = true;
            const successKey = this.developmentMode.enabled ? "user_account_advanced_section_developer_alert_success_enabled" : "user_account_advanced_section_developer_alert_success_disabled";
            userAccountServiceInfos
                .updateDeveloperMode(this.developmentMode)
                .then(() => {
                    const zone = "useraccount.alerts.dashboardAdvanced";
                    return Alerter.success($translate.instant(successKey), zone);
                }, () => {
                    const zone = "useraccount.alerts.dashboardAdvanced";
                    return Alerter.error($translate.instant("user_account_advanced_section_developer_alert_error"), zone);
                })
                .finally(() => {
                    this.isLoadingDeveloperMode = false;
                });
        };

        this.$ngInit();
    }
]);
