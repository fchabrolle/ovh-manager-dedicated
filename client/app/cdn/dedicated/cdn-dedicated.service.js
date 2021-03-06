angular.module("services").service("Cdn", function ($cacheFactory, Products, $http, $q, constants, $rootScope, Poll, OvhHttp) {
    const self = this;
    const swsCdnProxyPath = `${constants.swsProxyRootPath}cdn/dedicated`;
    const swsOrderProxyPath = `${constants.swsProxyRootPath}order/cdn/dedicated`;
    const aapiRootPath = "/sws/dedicated/cdn";
    const cdnCache = $cacheFactory("UNIVERS_DEDICATED_CDN");
    const requests = {
        cdnDetails: null
    };

    function resetCache (key) {
        if (key !== undefined) {
            if (requests[key] !== undefined) {
                requests[key] = null;
            }
            cdnCache.remove(key);
        } else {
            cdnCache.removeAll();
            for (const request in requests) {
                if (requests.hasOwnProperty(request)) {
                    requests[request] = null;
                }
            }
        }
    }

    this.getSelected = function (productId, forceRefresh) {
        if (forceRefresh) {
            resetCache();
        }

        return Products.getSelectedProduct(productId)
            .then((product) => {
                if (product) {
                    const selectedCdn = cdnCache.get("cdn");
                    if (!selectedCdn) {
                        if (requests.cdnDetails === null) {
                            requests.cdnDetails = $http
                                .get([aapiRootPath, "get-service", product.name].join("/"), {
                                    serviceType: "aapi"
                                })
                                .then((result) => {
                                    cdnCache.put("cdn", result.data);
                                }); // .catch(() => {});
                        }
                        return requests.cdnDetails;
                    }
                    return selectedCdn;
                }
                return $q.reject(product);
            })
            .then(() => cdnCache.get("cdn"), (reason) => $q.reject(reason));
    };

    this.poll = function (opts) {
        // broadcast start with opts
        $rootScope.$broadcast(`${opts.namespace}.start`, opts);

        // do poll
        return Poll.poll([swsCdnProxyPath, opts.serviceName, "ssl/tasks", opts.taskId].join("/"), null, {
            namespace: opts.namespace
        }).then((resp) => resp);
    };

    this.killAllPolling = function () {
        angular.forEach(["installSsl"], (action) => {
            Poll.kill({ namespace: `cdn.${action}` });
        });
    };

    this.pollSetSslTask = function (opts) {
        const namespace = `cdn.${opts.taskFunction}`;
        opts.namespace = namespace;
        return self
            .poll({
                serviceName: opts.serviceName,
                taskId: opts.taskId,
                namespace
            })
            .then((infos) => {
                if (!infos) {
                    $rootScope.$broadcast(`${opts.namespace}.error`, opts);
                } else {
                    $rootScope.$broadcast(`${opts.namespace}.done`, infos);
                }
            });
    };

    /*
        * Add a domain to the CDN linked to the given backend
        */
    this.addDomain = function (productId, domain) {
        let result = null;
        return this.getSelected(productId)
            .then((cdn) => {
                if (cdn && cdn.serviceName) {
                    return $http.post([swsCdnProxyPath, cdn.serviceName, "domains"].join("/"), { domain: domain.domain }).then(() =>
                        $http.post([swsCdnProxyPath, cdn.serviceName, "domains", domain.domain, "backends"].join("/"), { ip: domain.backend }).then((data) => {
                            result = data;
                        })
                    );
                }
                return $q.reject(cdn);
            })
            .then(() => result, (http) => $q.reject(http.data));
    };

    /*
        * get the backends for the cdn.
        */
    this.getBackends = function (productId) {
        let result = null;
        return this.getSelected(productId)
            .then((cdn) => {
                if (cdn && cdn.serviceName) {
                    return $http
                        .get([aapiRootPath, cdn.serviceName, "backends"].join("/"), {
                            serviceType: "aapi"
                        })
                        .then((data) => {
                            result = data.data;
                        });
                }
                return $q.reject(cdn);
            })
            .then(
                () => result,
                (reason) => {
                    if (reason && reason.data !== undefined) {
                        return $q.reject(reason.data);
                    }
                    return $q.reject(reason);
                }
            );
    };

    /*
        * get the backends for the cdn.
        */
    this.getBackendPrice = function (serviceName) {
        return $http
            .get([swsOrderProxyPath, `${serviceName}/backend/01`].join("/"), {
                params: {
                    backend: 1
                }
            })
            .then(
                (response) => ({
                    withoutTax: null,
                    tax: null,
                    withTax: null,
                    contracts: null,
                    url: null,
                    duration: null,
                    unitaryPrice: response.data.prices.withoutTax.text,
                    quantity: null
                }),
                (reason) => {
                    if (reason && reason.data !== undefined) {
                        return $q.reject(reason.data);
                    }
                    return $q.reject(reason);
                }
            );
    };

    /*
        * get the backends orders for the cdn.
        */
    this.getBackendOrders = function (productId, quantity) {
        let result = null;
        return this.getSelected(productId)
            .then((cdn) => {
                if (cdn && cdn.serviceName && quantity) {
                    return $http
                        .get(`${[aapiRootPath, cdn.serviceName, "order", "backends"].join("/")}?quantity=${quantity}`, {
                            serviceType: "aapi"
                        })
                        .then((data) => {
                            result = data.data;
                        });
                }
                return $q.reject(cdn);
            })
            .then(
                () => result,
                (reason) => {
                    if (reason && reason.data !== undefined) {
                        return $q.reject(reason.data);
                    }
                    return $q.reject(reason);
                }
            );
    };

    function transformDuration (serviceName, duration) {
        const regex = /([0-9]+[mdjya]?|uptoFirstDayNextMonth|upto-[0-9]{4}-[0-9]{2}-[0-9]{2})(?:\.(engage\d+(?:m|d|y)))?/;

        const durationObj = {
            duration
        };

        if (regex.test(duration)) {
            const durationMatch = regex.exec(duration);

            if (durationMatch[1] && _.startsWith(durationMatch[1], "upto-")) {
                durationObj.date = new Date(durationMatch[1].substring(5));
            } else {
                const dateMatch = /([0-9]+)([mdjya]{0,1})/g.exec(durationMatch[1]);
                const dateValue = parseInt(dateMatch[1], 10);
                const dateUnit = dateMatch[2];

                durationObj.date = new Date();

                if (dateUnit === "d" || dateUnit === "j") {
                    durationObj.date.setDate(durationObj.date.getDate() + dateValue);
                } else if (dateUnit === "y" || dateUnit === "a") {
                    durationObj.date.setFullYear(durationObj.date.getFullYear() + dateValue);
                } else {
                    durationObj.date.setMonth(durationObj.date.getMonth() + dateValue);
                }
            }

            if (durationMatch[2] && _.startsWith(durationMatch[2], "engage")) {
                durationObj.engagementEnd = new Date();

                const engageString = durationMatch[2].substring(6);

                const engageMatch = /([0-9]+)([mdjya]{0,1})/g.exec(engageString);
                const engageValue = parseInt(engageMatch[1], 10);
                const engageUnit = engageMatch[2];

                if (engageUnit === "d" || engageUnit === "j") {
                    durationObj.engagementEnd.setDate(durationObj.engagementEnd.getDate() + engageValue);
                } else if (engageUnit === "y" || engageUnit === "a") {
                    durationObj.engagementEnd.setFullYear(durationObj.engagementEnd.getFullYear() + engageValue);
                } else {
                    durationObj.engagementEnd.setMonth(durationObj.engagementEnd.getMonth() + engageValue);
                }
            } else {
                durationObj.engagementEnd = null;
            }
        }

        return durationObj;
    }

    /*
        * get the backends for the cdn.
        */
    this.orderBackends = function (productId, quantity, duration) {
        let result = null;
        return this.getSelected(productId)
            .then((cdn) => {
                if (cdn && cdn.serviceName && quantity && duration) {
                    return $http.post([swsOrderProxyPath, cdn.serviceName, "backend", duration].join("/"), { backend: quantity }).then((response) => {
                        result = {
                            withoutTax: response.data.prices.withoutTax.text,
                            tax: response.data.prices.tax.text,
                            withTax: response.data.prices.withTax.text,
                            contracts: response.data.contracts,
                            url: response.data.url,
                            duration: transformDuration(cdn.serviceName, duration),
                            unitaryPrice: null,
                            quantity
                        };
                    });
                }
                return $q.reject(cdn);
            })
            .then(
                () => result,
                (reason) => {
                    if (reason && reason.data !== undefined) {
                        return $q.reject(reason.data);
                    }
                    return $q.reject(reason);
                }
            );
    };

    /**
     * Get Ssl information for selected service
     */
    this.getSsl = (productId) =>
        this.getSelected(productId).then((cdn) => {
            if (!cdn || !cdn.serviceName) {
                return $q.reject(cdn);
            }

            return $http
                .get([swsCdnProxyPath, cdn.serviceName, "ssl"].join("/"))
                .then((ssl) => {
                    ssl.data.status = _.snakeCase(ssl.data.status).toUpperCase();
                    return ssl.data;
                })
                .catch(() => ({
                    name: null,
                    cn: null,
                    status: null,
                    certificateValidFrom: null,
                    certificateValidTo: null
                }));
        });

    /**
     * Get Ssl information for selected service
     */
    this.getInstallSslTasksIds = function (selected) {
        return $http.get(`${[swsCdnProxyPath, selected, "ssl/tasks"].join("/")}?function=installSsl`).then((tasksIds) => tasksIds.data);
    };

    function getStatisticsConsts () {
        const cachedStats = cdnCache.get("statistics_consts");

        if (cachedStats) {
            return $q.when(cachedStats);
        }

        return $http.get(`${swsCdnProxyPath}.json`).then(
            (content) => {
                let StatsValueEnum = _.get(content, ["data", "models", "cdnanycast.StatsValueEnum", "enum"]);
                let StatsPeriodEnum = _.get(content, ["data", "models", "cdnanycast.StatsPeriodEnum", "enum"]);

                StatsValueEnum = _.map(StatsValueEnum, (t) => _.snakeCase(t).toUpperCase());
                StatsPeriodEnum = _.map(StatsPeriodEnum, (t) => _.snakeCase(t).toUpperCase());

                const stats = {
                    types: StatsValueEnum,
                    periods: StatsPeriodEnum
                };

                cdnCache.put("statistics_consts", stats);

                return stats;
            },
            (reason) => {
                if (reason && reason.data !== undefined) {
                    return $q.reject(reason.data);
                }
                return $q.reject(reason);
            }
        );
    }

    /**
     * Get the statistics constants for the cdn
     */
    this.getStatisticsConsts = function (domain) {
        return getStatisticsConsts().then((stats) => ({
            types: !domain ? ["QUOTA"].concat(stats.types) : stats.types,
            defaultType: "BANDWIDTH",
            periods: stats.periods,
            defaultPeriod: "DAY"
        }));
    };

    /**
     * Get the statistics for the cdn
     */
    this.getStatistics = function (productId, params) {
        let result = null;
        return this.getSelected(productId)
            .then((cdn) => {
                if (cdn && cdn.serviceName) {
                    return $http.get([aapiRootPath, cdn.serviceName, "statistics"].join("/"), { params, serviceType: "aapi" }).then((data) => {
                        if (data) {
                            result = data.data;
                        }
                    });
                }
                return $q.reject(cdn);
            })
            .then(
                () => result,
                (reason) => {
                    if (reason && reason.data !== undefined) {
                        return $q.reject(reason.data);
                    }
                    return $q.reject(reason);
                }
            );
    };

    /**
     * Delete ssl for selected service
     */
    this.deleteSsl = function (productId) {
        let result = null;
        return this.getSelected(productId)
            .then((cdn) => {
                if (cdn && cdn.serviceName) {
                    return $http.delete([swsCdnProxyPath, cdn.serviceName, "ssl"].join("/")).then((data) => {
                        result = {
                            id: data.data.taskId,
                            status: data.data.status
                        };

                        result.function = data.function;
                    });
                }
                return $q.reject(cdn);
            })
            .then(
                () => {
                    resetCache();
                    return result;
                },
                (reason) => {
                    if (reason && reason.data !== undefined) {
                        return $q.reject(reason.data);
                    }
                    return $q.reject(reason);
                }
            );
    };

    /*
        * Add a ssl certificate to the selected service
        */
    this.addSsl = function (productId, ssl) {
        let result = null;
        return this.getSelected(productId)
            .then((cdn) => {
                if (cdn && cdn.serviceName) {
                    return $http.post([swsCdnProxyPath, cdn.serviceName, "ssl"].join("/"), ssl).then((data) => {
                        result = data;
                        $rootScope.$broadcast("cdn.tabs.ssl.refresh");
                    });
                }
                return $q.reject(cdn);
            })
            .then(() => result, (http) => $q.reject(http.data));
    };

    /*
        * Update a ssl certificate to the selected service
        */
    this.updateSsl = function (serviceName, ssl) {
        return $http.post([swsCdnProxyPath, serviceName, "ssl/update"].join("/"), ssl).then((data) => {
            $rootScope.$broadcast("cdn.tabs.ssl.refresh");
            return data;
        });
    };

    /**
     * Get serviceInfos
     */
    this.getServiceInfos = (serviceName) =>
        OvhHttp.get("/cdn/dedicated/{serviceName}/serviceInfos", {
            rootPath: "apiv6",
            urlParams: {
                serviceName
            }
        });
});
