angular.module("App").controller("CdnTabSslCtrl", ($scope, $translate, Cdn, $stateParams) => {
    "use strict";

    $scope.ssl = null;
    $scope.task = null;
    $scope.loading = true;

    $scope.getBadgeClass = function (status) {
        switch (status) {
        case "CHECKING":
        case "REMOVING":
        case "CREATING":
        case "UPLOADING":
            return "label-warning";
        case "ERROR":
        case "OFF":
            return "label-danger";
        case "ON":
            return "label-success";
        default:
            return "";
        }
    };

    $scope.loadSsl = function () {
        $scope.loading = true;
        Cdn.getSsl($stateParams.productId).then(
            (ssl) => {
                $scope.loading = false;
                if (ssl.status === null) {
                    $scope.ssl = null;
                } else {
                    $scope.ssl = ssl;
                    getSslCreationTask();
                }
            },
            (error) => {
                $scope.loading = false;
                error.message = error.message.replace(" : null", "");
                $scope.setMessage($translate.instant("cdn_configuration_add_ssl_get_error"), { type: "ERROR", message: error.message });
            }
        );
    };

    // pooling for ssl certif canceling
    $scope.$on("cdn.installSsl.done", (e, infos) => {
        $scope.task = null;
        if (infos !== "done") {
            $scope.task = infos;
        }
        if ($scope.task && $scope.task.status === "cancelled") {
            $scope.ssl.status = infos.status.toUpperCase();
            Cdn.pollSetSslTask({
                serviceName: $stateParams.productId,
                taskId: infos.taskId,
                taskFunction: "installSsl"
            });
            $scope.taskErrorMessage = _.result(infos, "comment");
        }
    });
    $scope.$on("cdn.installSsl.error", () => {
        $scope.ssl = null;
        $scope.task = null;
    });
    $scope.$on("$destroy", () => {
        Cdn.killAllPolling();
    });

    $scope.disableDelCertificat = function () {
        return $scope.taskErrorMessage || ($scope.ssl && $scope.ssl.status !== "OFF" && $scope.ssl.status !== "ON");
    };

    function getSslCreationTask () {
        Cdn.getInstallSslTasksIds($stateParams.productId).then((sslTasks) => {
            if (sslTasks) {
                Cdn.pollSetSslTask({
                    serviceName: $stateParams.productId,
                    taskId: sslTasks[0],
                    taskFunction: "installSsl"
                });
            }
        });
    }

    $scope.$on("cdn.tabs.ssl.refresh", () => {
        $scope.loadSsl();
    });

    $scope.loadSsl();
});
