import { mock } from 'angular';

import Spy = jasmine.Spy;
import { IApplicationDataSourceAttribute, ApplicationReader } from './ApplicationReader';
import { API } from 'core/api/ApiService';
import { ApplicationDataSourceRegistry } from './ApplicationDataSourceRegistry';
import { Application } from '../application.model';
import { LOAD_BALANCER_DATA_SOURCE } from 'core/loadBalancer/loadBalancer.dataSource';
import { LOAD_BALANCER_READ_SERVICE, LoadBalancerReader } from 'core/loadBalancer/loadBalancer.read.service';
import { SECURITY_GROUP_READER, SecurityGroupReader } from 'core/securityGroup/securityGroupReader.service';
import { CLUSTER_SERVICE, ClusterService } from 'core/cluster/cluster.service';
import { SERVER_GROUP_DATA_SOURCE } from 'core/serverGroup/serverGroup.dataSource';
import { SECURITY_GROUP_DATA_SOURCE } from 'core/securityGroup/securityGroup.dataSource';

describe('ApplicationReader', function() {
  let securityGroupReader: SecurityGroupReader;
  let loadBalancerReader: any;
  let clusterService: ClusterService;
  let $q: ng.IQService;
  let $scope: ng.IScope;

  beforeEach(() => ApplicationDataSourceRegistry.clearDataSources());

  beforeEach(
    mock.module(
      SECURITY_GROUP_DATA_SOURCE,
      SERVER_GROUP_DATA_SOURCE,
      LOAD_BALANCER_DATA_SOURCE,
      SECURITY_GROUP_READER,
      CLUSTER_SERVICE,
      LOAD_BALANCER_READ_SERVICE,
    ),
  );

  beforeEach(
    mock.inject(function(
      _securityGroupReader_: SecurityGroupReader,
      _clusterService_: ClusterService,
      _$q_: ng.IQService,
      _loadBalancerReader_: LoadBalancerReader,
      $rootScope: ng.IRootScopeService,
    ) {
      securityGroupReader = _securityGroupReader_;
      clusterService = _clusterService_;
      loadBalancerReader = _loadBalancerReader_;
      $q = _$q_;
      $scope = $rootScope.$new();
    }),
  );

  describe('load application', function() {
    let application: Application = null;

    function loadApplication(dataSources?: IApplicationDataSourceAttribute) {
      const response = { applicationName: 'deck', attributes: {} as any };
      if (dataSources !== undefined) {
        response.attributes['dataSources'] = dataSources;
      }
      spyOn(API, 'one').and.returnValue({
        withParams: () => {
          return { get: () => $q.when(response) };
        },
      });
      spyOn(securityGroupReader, 'loadSecurityGroupsByApplicationName').and.returnValue($q.when([]));
      spyOn(loadBalancerReader, 'loadLoadBalancers').and.returnValue($q.when([]));
      spyOn(clusterService, 'loadServerGroups').and.returnValue($q.when([]));
      spyOn(securityGroupReader, 'loadSecurityGroups').and.returnValue($q.when([]));
      spyOn(securityGroupReader, 'getApplicationSecurityGroups').and.callFake(function(
        _app: Application,
        groupsByName: any,
      ) {
        return $q.when(groupsByName || []);
      });

      ApplicationReader.getApplication('deck').then(app => {
        application = app;
      });
      $scope.$digest();
    }

    it('loads all data sources if dataSource attribute is missing', function() {
      loadApplication();
      expect(application.attributes.dataSources).toBeUndefined();
      expect((clusterService.loadServerGroups as Spy).calls.count()).toBe(1);
      expect((securityGroupReader.getApplicationSecurityGroups as Spy).calls.count()).toBe(1);
      expect(loadBalancerReader.loadLoadBalancers.calls.count()).toBe(1);
    });

    it('loads all data sources if disabled dataSource attribute is an empty array', function() {
      loadApplication({ enabled: [], disabled: [] });
      expect((clusterService.loadServerGroups as Spy).calls.count()).toBe(1);
      expect((securityGroupReader.getApplicationSecurityGroups as Spy).calls.count()).toBe(1);
      expect(loadBalancerReader.loadLoadBalancers.calls.count()).toBe(1);
    });

    it('only loads configured dataSources if attribute is non-empty', function() {
      const dataSources = { enabled: ['serverGroups'], disabled: ['securityGroups', 'loadBalancers'] };
      loadApplication(dataSources);
      expect((clusterService.loadServerGroups as Spy).calls.count()).toBe(1);
      expect((securityGroupReader.getApplicationSecurityGroups as Spy).calls.count()).toBe(0);
      expect(loadBalancerReader.loadLoadBalancers.calls.count()).toBe(0);

      expect(application.getDataSource('serverGroups').disabled).toBe(false);
      expect(application.getDataSource('loadBalancers').disabled).toBe(true);
      expect(application.getDataSource('securityGroups').disabled).toBe(true);
    });

    describe('opt-in data sources', function() {
      beforeEach(function() {
        ApplicationDataSourceRegistry.registerDataSource({
          key: 'optInSource',
          visible: true,
          optional: true,
          optIn: true,
          defaultData: [],
        });
      });

      it('disables opt-in data sources when nothing configured on application dataSources attribute', function() {
        loadApplication();
        expect(application.getDataSource('optInSource').disabled).toBe(true);
      });

      it('disables opt-in data sources when nothing configured on application dataSources.disabled attribute', function() {
        loadApplication({ enabled: [], disabled: [] });
        expect(application.getDataSource('optInSource').disabled).toBe(true);
      });

      it('enables opt-in data source when configured on application dataSources.disabled attribute', function() {
        loadApplication({ enabled: ['optInSource'], disabled: [] });
        expect(application.getDataSource('optInSource').disabled).toBe(false);
      });
    });
  });
});
