// --------------DSABLE BACKUP------------------

angular.module("App").controller("HousingDeleteFtpBackupCtrl", ($scope, $stateParams, $translate, Housing, Alerter) => {
    "use strict";

    const alert = "housing_tab_ftpbackup_alert";
    $scope.ftpBackup = $scope.currentActionData;
    $scope.loading = false;

    $scope.deleteFtpBackup = function () {
        $scope.loading = true;

        Housing.deleteFtpBackup($stateParams.productId)
            .then(
                () => {
                    Alerter.success($translate.instant("housing_configuration_ftpbackup_delete_success"), alert);
                },
                (data) => {
                    Alerter.alertFromSWS($translate.instant("housing_configuration_ftpbackup_delete_failure"), data, alert);
                }
            )
            .finally(() => {
                $scope.resetAction();
            });
    };
});
