// code/client/src/utils/api.js
// 数据访问统一入口——按构建开关 VITE_DATA_LAYER（rest/local）分发数据层实现
import {
  recordsApi as restRecordsApi,
  subjectsApi as restSubjectsApi,
  tagsApi as restTagsApi,
  remindersApi as restRemindersApi,
  exportApi as restExportApi,
  importApi as restImportApi,
} from './apiRest.js';
import {
  recordsApi as localRecordsApi,
  subjectsApi as localSubjectsApi,
  tagsApi as localTagsApi,
  remindersApi as localRemindersApi,
  exportApi as localExportApi,
  importApi as localImportApi,
} from './apiLocal.js';

const useLocal = import.meta.env.VITE_DATA_LAYER === 'local';

export const recordsApi = useLocal ? localRecordsApi : restRecordsApi;
export const subjectsApi = useLocal ? localSubjectsApi : restSubjectsApi;
export const tagsApi = useLocal ? localTagsApi : restTagsApi;
export const remindersApi = useLocal ? localRemindersApi : restRemindersApi;
export const exportApi = useLocal ? localExportApi : restExportApi;
export const importApi = useLocal ? localImportApi : restImportApi;
