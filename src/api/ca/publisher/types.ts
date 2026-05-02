export interface PublisherQuery {
  pageNum?: number;
  pageSize?: number;
  name?: string;
}

export interface PublisherForm {
  id?: string | number;
  name?: string;
  type?: string;
  conf?: string;
}

export interface PublisherCO {
  id: string | number;
  name: string;
  type?: string;
  conf?: string;
  createTime?: string;
  updateTime?: string;
}
