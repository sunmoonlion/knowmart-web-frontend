import { defineDestinations } from '@/lib/cross-app/links'

// 这个应用会把用户带去的页面，都登记在这里。模板没有要去的地方；各应用在自己的仓库里填。
//
// 例：
//   'info.request': { target: 'knowfeed', segments: ['requests', 'new'], params: ['code'] },
//   'knowledge.dataset': { target: 'knowbase', segments: ['catalog', ':dataset'] },
export const destinations = defineDestinations({
  // 「去工作台请」：不是从工作台来时，带去工作台主页的「专家」；在那里点「请我的分身」再回来选（SDD 0032）
  'knowbench.expert': { target: 'knowbench', segments: ['workbench'], params: ['mode'] },
  // 停用 knowlab 交来的专家：到 knowlab web端「专家」栏（SDD 0037 第六节）
  'knowlab.experts': { target: 'knowlab', segments: ['experts'] },
  // 小店「交易记录」直达那份资料：knowbase web端总栏（买来的 / 我上传的），带资料编号
  // （SDD 0018 第十一节第 7 之二小节）。knowbase 那页的路径与参数以 knowbase web端（0044）落地为准
  'knowbase.library': {
    target: 'knowbase',
    segments: ['library'],
    params: ['category', 'material'],
  },
  // 直达那位专家：knowbench「专家」栏，请过的照旧能请（已下架的那边标「不可请」）
  'knowbench.experts': { target: 'knowbench', segments: ['workbench', 'expert'] },
})

export type DestinationKey = keyof typeof destinations
