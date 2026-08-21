import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { RadarChartOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const ruleLabels = {
  monthly_above_60m: '月线站上60月线',
  monthly_bull_alignment: '月线5/10/20/60多头',
  monthly_three_closes_above_5m: '连续3个月站上5月线',
  weekly_bull_alignment: '周线5/10/20多头且20周线上行',
  daily_bull_alignment: '日线5/10/20多头',
};

function statusTag(status) {
  const map = { pass: ['success', '符合'], fail: ['error', '不符合'], insufficient: ['warning', '资料不足'] };
  const [color, label] = map[status] || ['default', status || '未知'];
  return <Tag color={color}>{label}</Tag>;
}

export default function StockScanner() {
  const [loading, setLoading] = useState(false);
  const [excludeRisk, setExcludeRisk] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const runScan = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/stocks/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exclude_risk: excludeRisk, max_workers: 8 }),
        signal: AbortSignal.timeout(180000),
      });
      if (!res.ok) throw new Error(`扫描接口返回 ${res.status}`);
      setData(await res.json());
      message.success('扫描完成');
    } catch (e) { setError(e.message || '扫描失败，请检查行情源和服务状态'); }
    finally { setLoading(false); }
  };

  const rows = useMemo(() => (data?.results || []).map((item) => {
    const required = Object.entries(item.rules || {}).filter(([key]) => ruleLabels[key]);
    const ruleSummary = required.map(([key, rule]) => `${ruleLabels[key]}：${rule.status === 'pass' ? '符合' : '不符合'}`).join('；');
    return { ...item, key: item.code, ruleSummary };
  }), [data]);

  const columns = [
    { title: '代码', dataIndex: 'code', width: 90, fixed: 'left' },
    { title: '名称', dataIndex: 'name', width: 110, fixed: 'left' },
    { title: '最新收盘', dataIndex: 'price', width: 105, render: (v) => v == null ? '-' : v.toFixed(2) },
    { title: '20日涨跌', dataIndex: 'change_20d_pct', width: 100, render: (v) => v == null ? '-' : <span style={{ color: v >= 0 ? '#16a34a' : '#dc2626' }}>{v.toFixed(2)}%</span> },
    { title: '硬规则通过', dataIndex: 'exact_required_passed', width: 110 },
    { title: '结论', dataIndex: 'status', width: 90, render: statusTag },
    { title: '规则摘要', dataIndex: 'ruleSummary', ellipsis: true },
  ];

  const passCount = data?.results?.filter((x) => x.status === 'pass').length || 0;
  const insufficientCount = data?.results?.filter((x) => x.status === 'insufficient').length || 0;

  return <div style={{ padding: 24 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <Typography.Title level={2} style={{ margin: 0 }}>日周月全市场扫描</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, maxWidth: 820 }}>
          严格按“月线 → 周线 → 日线”的新增资料顺序筛选。自动判定只使用资料中明确、可计算的条件；分时、筹码峰、主力行为和模糊形态会保留为“资料不足”，不会被系统擅自猜测。
        </Typography.Paragraph>
      </div>
      <Space>
        <Checkbox checked={excludeRisk} onChange={(e) => setExcludeRisk(e.target.checked)}>排除ST/风险警示</Checkbox>
        <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={runScan}>开始全市场扫描</Button>
      </Space>
    </div>

    {error && <Alert type="error" showIcon message="扫描失败" description={error} closable onClose={() => setError('')} style={{ marginBottom: 16 }} />}
    <Alert type="info" showIcon icon={<SafetyCertificateOutlined />} message="规则边界" description="‘符合’仅表示月线、周线、日线硬条件同时通过，不代表收益保证；自动扫描不替代博主资料要求的分时和筹码人工确认。" style={{ marginBottom: 16 }} />

    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={8}><Card><Statistic title="股票池数量" value={data?.universe_count || 0} suffix="只" /></Card></Col>
      <Col xs={24} sm={8}><Card><Statistic title="严格通过" value={passCount} suffix="只" valueStyle={{ color: '#16a34a' }} /></Card></Col>
      <Col xs={24} sm={8}><Card><Statistic title="资料不足" value={insufficientCount} suffix="只" valueStyle={{ color: '#d97706' }} /></Card></Col>
    </Row>

    <Card title={<Space><RadarChartOutlined />扫描结果</Space>} extra={data?.as_of ? `扫描时间：${data.as_of}` : '尚未扫描'}>
      <Table columns={columns} dataSource={rows} loading={loading} scroll={{ x: 920 }} pagination={{ pageSize: 30, showSizeChanger: true }} locale={{ emptyText: '点击右上角“开始全市场扫描”获取结果' }} />
    </Card>
  </div>;
}
