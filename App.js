Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    _users:[],
    launch: function() {
        var millisecondsInDay = 86400000;
        var currentDate = new Date();
        var lookback = 30;
        var startDate = (new Date(currentDate - millisecondsInDay*lookback)).toISOString(); //in the last 30 days
        var that = this;
        var stories = Ext.create('Rally.data.wsapi.Store', {
            model: 'UserStory',
            fetch: ['Name','FormattedID','RevisionHistory','Revisions','User','UserName'],
            limit: Infinity,
            autoLoad: true,
            filters: [
               {
                   property: 'CreationDate',
                   operator: '>=',
                   value: startDate
               }
            ]
        });
        stories.load().then({
            success: this._getRevHistoryModel,
            scope: this
        }).then({
            success: this._onRevHistoryModelCreated,
            scope: this
        }).then({
            success: this._onModelLoaded,
            scope: this
        }).then({
            success: this._stitchDataTogether,
            scope: this
        }).then({
            success:function(results) {
                that._makeGrid(results);
            },
            failure: function(){
                console.log("oh noes!");
            }
        });
    },
    _getRevHistoryModel:function(stories){
        this._stories = stories;
        return Rally.data.ModelFactory.getModel({
            type: 'RevisionHistory'
        });
    },
  _onRevHistoryModelCreated: function(model) {
    var that = this;
    var promises = [];
    _.each(this._stories, function(story){
      var ref = story.get('RevisionHistory')._ref;
        promises.push(model.load(Rally.util.Ref.getOidFromRef(ref)));
    }); 
    return Deft.Promise.all(promises);  
   },
    
    _onModelLoaded: function(histories) {
      var promises = [];
      _.each(histories, function(history){
        var revisions = history.get('Revisions');
        revisions.store = history.getCollection('Revisions',{fetch:['User','CreationDate','Description']});
        promises.push(revisions.store.load());
      });
      return Deft.Promise.all(promises);  
    },
    _stitchDataTogether:function(revhistories){
      var that = this;
      var storiesWithRevs = [];
      _.each(that._stories, function(story){
        storiesWithRevs.push({story: story.data});
      });
      var i = 0;
      _.each(revhistories, function(revisions){
        var originalRev = _.last(revisions).data;
        storiesWithRevs[i].originalRevision = originalRev;
        i++;
      });
      return storiesWithRevs;

    },

    _makeGrid: function(usersWithRevs){
      console.log(usersWithRevs);
      this.add({
            xtype: 'rallygrid',
            showPagingToolbar: true,
            showRowActionsColumn: false,
            editable: false,
            store: Ext.create('Rally.data.custom.Store', {
                data: usersWithRevs
            }),
            columnCfgs: [
                {
                    text: 'Name',dataIndex: 'story', minWidth:300,
                    renderer:function(value){
                        return value.FormattedID + '  ' + value.Name ;
                    }
                },
                {
                    text: 'Created by',dataIndex: 'originalRevision', minWidth:200,
                    renderer:function(value){
                        return value.User._refObjectName;
                    }
                },
                {
                    text: 'Created on',dataIndex: 'originalRevision', minWidth:200,
                    renderer:function(value){
                        return value.CreationDate;
                    }
                }
            ]
        });
        
    }
    
});