/**
 * 标准组织架构示意（原型）
 * - 非完整组织树 UI，仅部门→人员级联示意
 * - 默认当前登录人：调度中心 · 张调度
 */
(function (global) {
  var ORG = [
    {
      id: 'dep-dispatch',
      name: '调度中心',
      people: [
        { id: 'u-zs', name: '张调度' },
        { id: 'u-ls', name: '李调度' },
        { id: 'u-ww', name: '王调度' }
      ]
    },
    {
      id: 'dep-ops',
      name: '作业部',
      people: [
        { id: 'u-zb', name: '赵班长' },
        { id: 'u-qb', name: '钱班长' }
      ]
    },
    {
      id: 'dep-tech',
      name: '设备部',
      people: [
        { id: 'u-sg', name: '孙工' },
        { id: 'u-zg', name: '周工' }
      ]
    }
  ];

  var CURRENT = {
    deptId: 'dep-dispatch',
    deptName: '调度中心',
    userId: 'u-zs',
    userName: '张调度'
  };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function listDepts() {
    return ORG.map(function (d) { return { id: d.id, name: d.name }; });
  }

  function listPeople(deptId) {
    for (var i = 0; i < ORG.length; i++) {
      if (ORG[i].id === deptId) return clone(ORG[i].people);
    }
    return [];
  }

  function getDeptName(deptId) {
    for (var i = 0; i < ORG.length; i++) if (ORG[i].id === deptId) return ORG[i].name;
    return '';
  }

  function getPersonName(deptId, userId) {
    var people = listPeople(deptId);
    for (var i = 0; i < people.length; i++) if (people[i].id === userId) return people[i].name;
    return '';
  }

  function currentUser() {
    return clone(CURRENT);
  }

  global.OrgDemo = {
    listDepts: listDepts,
    listPeople: listPeople,
    getDeptName: getDeptName,
    getPersonName: getPersonName,
    currentUser: currentUser
  };
})(window);
