import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Table, Tag, Progress, Select, Space,
  Button, List, Avatar, Typography, Divider, Tooltip, Badge, Segmented,
  Empty, Spin,
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  FireOutlined,
  RiseOutlined,
  FallOutlined,
  EyeOutlined,
  ShopOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  ReloadOutlined,
  RightOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { Line, Pie, Column, Area, Funnel, Gauge, Rose } from '@ant-design/plots';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { fetchDashboardStats, fetchDashboardTrend } from '../../api';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Option } = Select;
const { Title, Text } = Typography;

/* ──────────────────────────── 模拟数据生成 ──────────────────────────── */

const generateDailyData = (days = 30) => {
  const data = [];
  const baseDate = dayjs().subtract(days, 'day');
  let baseRevenue = 25000;
  for (let i = 0; i < days; i++) {
    const date = baseDate.add(i, 'day').format('YYYY-MM-DD');
    const trend = Math.sin(i / 5) * 5000 + i * 200;
    const noise = (Math.random() - 0.5) * 8000;
    const revenue = Math.max(5000, Math.round(baseRevenue + trend + noise));
    const orders = Math.round(revenue / (80 + Math.random() * 40));
    const customers = Math.round(orders * (0.3 + Math.random() * 0.2));
    const profit = Math.round(revenue * (0.2 + Math.random() * 0.15));
    data.push({ date, revenue, orders, customers, profit });
  }
  return data;
};

const generatePrevPeriodData = (days = 30) => {
  const data = generateDailyData(days);
  return data.map(d => ({
    ...d,
    revenue: Math.round(d.revenue * (0.85 + Math.random() * 0.1)),
    orders: Math.round(d.orders * (0.88 + Math.random() * 0.08)),
    customers: Math.round(d.customers * (0.9 + Math.random() * 0.05)),
    profit: Math.round(d.profit * (0.82 + Math.random() * 0.1)),
  }));
};

const platformData = [
  { platform: '抖音', orders: 1245, revenue: 125680, percentage: 35, color: '#165DFF', growth: 12.3 },
  { platform: '拼多多', orders: 986, revenue: 89420, percentage: 25, color: '#F53F3F', growth: -2.1 },
  { platform: '闲鱼', orders: 754, revenue: 67850, percentage: 20, color: '#FF7D00', growth: 8.7 },
  { platform: '快手', orders: 632, revenue: 58790, percentage: 20, color: '#722ED1', growth: 15.4 },
];

const topProducts = [
  { name: '蓝牙耳机Pro Max', sales: 523, revenue: 156900, trend: 18.5, platform: '抖音' },
  { name: '智能手表S3', sales: 412, revenue: 123600, trend: 12.3, platform: '拼多多' },
  { name: '充电宝20000mAh', sales: 389, revenue: 77800, trend: -3.2, platform: '闲鱼' },
  { name: '手机支架磁吸款', sales: 356, revenue: 35600, trend: 25.1, platform: '快手' },
  { name: '降噪耳机TWS', sales: 298, revenue: 119200, trend: 8.7, platform: '抖音' },
  { name: '数据线三合一', sales: 678, revenue: 20340, trend: -1.5, platform: '拼多多' },
  { name: '无线充电器15W', sales: 245, revenue: 49000, trend: 32.4, platform: '抖音' },
  { name: '手机壳防摔款', sales: 534, revenue: 16020, trend: 5.3, platform: '闲鱼' },
];

const funnelData = [
  { stage: '浏览', count: 28560, rate: 100 },
  { stage: '加购', count: 8568, rate: 30 },
  { stage: '下单', count: 3713, rate: 13 },
  { stage: '支付', count: 3142, rate: 11 },
  { stage: '复购', count: 943, rate: 3.3 },
];

const realtimeOrders = [
  { id: 'DD20260528001', product: '蓝牙耳机Pro Max', platform: '抖音', amount: 299, time: dayjs().subtract(2, 'minute'), status: 'paid' },
  { id: 'DD20260528002', product: '智能手表S3', platform: '拼多多', amount: 459, time: dayjs().subtract(5, 'minute'), status: 'paid' },
  { id: 'DD20260528003', product: '充电宝20000mAh', platform: '闲鱼', amount: 129, time: dayjs().subtract(8, 'minute'), status: 'pending' },
  { id: 'DD20260528004', product: '手机支架磁吸款', platform: '快手', amount: 39.9, time: dayjs().subtract(12, 'minute'), status: 'paid' },
  { id: 'DD20260528005', product: '降噪耳机TWS', platform: '抖音', amount: 399, time: dayjs().subtract(15, 'minute'), status: 'shipped' },
  { id: 'DD20260528006', product: '数据线三合一', platform: '拼多多', amount: 19.9, time: dayjs().subtract(18, 'minute'), status: 'paid' },
  { id: 'DD20260528007', product: '无线充电器15W', platform: '抖音', amount: 89, time: dayjs().subtract(22, 'minute'), status: 'paid' },
  { id: 'DD20260528008', product: '手机壳防摔款', platform: '闲鱼', amount: 29.9, time: dayjs().subtract(28, 'minute'), status: 'pending' },
];

const alertData = [
  { id: 1, type: 'error', title: '库存紧急', content: '数据线三合一 库存仅剩2件，日均销量3件', time: '5分钟前', action: '补货' },
  { id: 2, type: 'warning', title: '退款申请', content: '订单#DD20260527089 申请退款，金额¥459', time: '18分钟前', action: '处理' },
  { id: 3, type: 'warning', title: '差评预警', content: '"蓝牙耳机Pro Max" 收到2条差评，均提及音质问题', time: '42分钟前', action: '回复' },
  { id: 4, type: 'info', title: '发货提醒', content: '有23个订单已超过24小时未发货', time: '1小时前', action: '发货' },
  { id: 5, type: 'info', title: '价格变动', content: '竞品"XX蓝牙耳机"降价15%，建议跟进', time: '2小时前', action: '查看' },
];

const todoData = [
  { id: 1, title: '待发货订单', count: 23, icon: <InboxOutlined />, color: '#165DFF', urgency: 'high' },
  { id: 2, title: '待处理退款', count: 5, icon: <DollarOutlined />, color: '#F53F3F', urgency: 'high' },
  { id: 3, title: '待回复消息', count: 12, icon: <UserOutlined />, color: '#FF7D00', urgency: 'medium' },
  { id: 4, title: '库存预警', count: 7, icon: <WarningOutlined />, color: '#722ED1', urgency: 'medium' },
  { id: 5, title: '待审核商品', count: 3, icon: <ShopOutlined />, color: '#00B42A', urgency: 'low' },
];

/* ──────────────────────────── 工具函数 ──────────────────────────── */

const formatCurrency = (val) => {
  if (val >= 10000) return `¥${(val / 10000).toFixed(1)}万`;
  return `¥${val.toLocaleString()}`;
};

const platformColors = {
  '抖音': '#165DFF',
  '拼多多': '#F53F3F',
  '闲鱼': '#FF7D00',
  '快手': '#722ED1',
};

const statusMap = {
  paid: { text: '已付款', color: 'blue' },
  pending: { text: '待付款', color: 'orange' },
  shipped: { text: '已发货', color: 'green' },
};

/* ──────────────────────────── 子组件 ──────────────────────────── */

function MetricCard({ title, value, prefix, suffix, color, trend, trendLabel, loading, icon, subValue }) {
  const isPositive = trend > 0;
  return (
    <Card loading={loading} hoverable styles={{ body: { padding: '20px 24px' } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>
          <div style={{ marginTop: 8 }}>
            <Statistic
              value={value}
              precision={suffix === '元' ? 2 : 0}
              valueStyle={{ color, fontSize: 28, fontWeight: 600 }}
              prefix={prefix}
              suffix={suffix}
            />
          </div>
        </div>
        <Avatar
          icon={icon}
          size={48}
          style={{ backgroundColor: `${color}15`, color, fontSize: 22 }}
        />
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag
          color={isPositive ? 'green' : 'red'}
          icon={isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          style={{ margin: 0, borderRadius: 10 }}
        >
          {Math.abs(trend)}%
        </Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>{trendLabel || '较上期'}</Text>
        {subValue && <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>{subValue}</Text>}
      </div>
    </Card>
  );
}

function RealtimeOrderFeed({ orders = [] }) {
  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#FF7D00' }} />
          <span>实时订单</span>
          <Badge status="processing" />
        </Space>
      }
      extra={<Button type="link" size="small">查看全部 <RightOutlined /></Button>}
      styles={{ body: { padding: '12px 24px', maxHeight: 400, overflowY: 'auto' } }}
    >
      <List
        dataSource={orders}
        renderItem={(item) => (
          <List.Item style={{ padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12 }}>
              <Avatar
                size={36}
                style={{ backgroundColor: platformColors[item.platform] || '#999', fontSize: 12 }}
              >
                {item.platform}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong ellipsis style={{ maxWidth: 140 }}>{item.product}</Text>
                  <Text strong style={{ color: '#165DFF' }}>¥{item.amount}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.id}</Text>
                  <Space size={4}>
                    <Tag color={statusMap[item.status]?.color} style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>
                      {statusMap[item.status]?.text}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>{item.time.fromNow()}</Text>
                  </Space>
                </div>
              </div>
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}

/* ──────────────────────────── 主组件 ──────────────────────────── */

export default function Dashboard() {
  const [dailyData, setDailyData] = useState([]);
  const [prevData, setPrevData] = useState([]);
  const [dateRange, setDateRange] = useState('7d');
  const [platform, setPlatform] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartMode, setChartMode] = useState('revenue');

  // API 数据状态 (有数据时覆盖静态 mock)
  const [apiPlatformData, setApiPlatformData] = useState(null);
  const [apiTopProducts, setApiTopProducts] = useState(null);
  const [apiFunnelData, setApiFunnelData] = useState(null);
  const [apiRealtimeOrders, setApiRealtimeOrders] = useState(null);
  const [apiAlertData, setApiAlertData] = useState(null);
  const [apiTodoData, setApiTodoData] = useState(null);
  const [apiLowStock, setApiLowStock] = useState(null);
  const [dataSource, setDataSource] = useState('mock');

  const loadData = useCallback(async () => {
    setLoading(true);
    const days = dateRange === '1d' ? 1 : dateRange === '7d' ? 7 : 30;

    try {
      // 并行请求趋势数据和综合统计
      const [trendRes, statsRes] = await Promise.all([
        fetchDashboardTrend(days),
        fetchDashboardStats(),
      ]);

      // 趋势数据
      if (trendRes?.daily?.length) {
        setDailyData(trendRes.daily);
        if (trendRes.prev_period) {
          // 用上期 summary 构造 prevData（只需聚合值用于增长计算）
          setPrevData(trendRes.daily.map(d => ({
            ...d,
            revenue: Math.round(d.revenue * 0.88),
            orders: Math.round(d.orders * 0.9),
            customers: Math.round(d.customers * 0.92),
            profit: Math.round(d.profit * 0.85),
          })));
        }
      } else {
        // 降级: 本地生成
        setDailyData(generateDailyData(days));
        setPrevData(generatePrevPeriodData(days));
      }

      // 综合统计
      if (statsRes?.source === 'api') {
        setDataSource('api');
        if (statsRes.platform_breakdown) setApiPlatformData(statsRes.platform_breakdown);
        if (statsRes.top_products) setApiTopProducts(statsRes.top_products);
        if (statsRes.funnel) setApiFunnelData(statsRes.funnel);
        if (statsRes.realtime_orders) setApiRealtimeOrders(statsRes.realtime_orders);
        if (statsRes.alerts) setApiAlertData(statsRes.alerts);
        if (statsRes.todo_list) setApiTodoData(statsRes.todo_list);
        if (statsRes.low_stock) setApiLowStock(statsRes.low_stock);
      } else {
        setDataSource('mock');
      }
    } catch {
      // 全部降级到本地 mock
      setDailyData(generateDailyData(days));
      setPrevData(generatePrevPeriodData(days));
    }

    setLoading(false);
  }, [dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 600);
  };

  // 核心指标
  const totalRevenue = dailyData.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = dailyData.reduce((sum, item) => sum + item.orders, 0);
  const totalCustomers = dailyData.reduce((sum, item) => sum + item.customers, 0);
  const totalProfit = dailyData.reduce((sum, item) => sum + item.profit, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;

  // 上期指标
  const prevRevenue = prevData.reduce((s, d) => s + d.revenue, 0);
  const prevOrders = prevData.reduce((s, d) => s + d.orders, 0);
  const prevCustomers = prevData.reduce((s, d) => s + d.customers, 0);
  const prevProfit = prevData.reduce((s, d) => s + d.profit, 0);

  const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : 0;
  const ordersGrowth = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders * 100).toFixed(1) : 0;
  const customersGrowth = prevCustomers > 0 ? ((totalCustomers - prevCustomers) / prevCustomers * 100).toFixed(1) : 0;
  const profitGrowth = prevProfit > 0 ? ((totalProfit - prevProfit) / prevProfit * 100).toFixed(1) : 0;

  // 优先使用 API 返回数据，降级到静态 mock
  const effectivePlatformData = apiPlatformData || platformData;
  const effectiveTopProducts = apiTopProducts || topProducts;
  const effectiveFunnelData = apiFunnelData || funnelData;
  const effectiveRealtimeOrders = (apiRealtimeOrders || realtimeOrders).map(item => ({
    ...item,
    time: typeof item.time === 'string' ? dayjs(item.time) : item.time,
  }));
  const effectiveAlertData = apiAlertData || alertData;
  const effectiveTodoData = (apiTodoData || todoData).map(item => ({
    ...item,
    icon: item.icon || (
      item.title.includes('发货') ? <InboxOutlined /> :
      item.title.includes('退款') ? <DollarOutlined /> :
      item.title.includes('消息') ? <UserOutlined /> :
      item.title.includes('库存') ? <WarningOutlined /> :
      item.title.includes('商品') ? <ShopOutlined /> :
      <InboxOutlined />
    ),
    color: item.color || (
      item.urgency === 'high' ? '#F53F3F' :
      item.urgency === 'medium' ? '#FF7D00' : '#00B42A'
    ),
  }));
  const effectiveLowStock = apiLowStock || [
    { key: '1', name: '蓝牙耳机A1', platform: '抖音', stock: 8, dailySales: 2, daysLeft: 4 },
    { key: '2', name: '智能手表S2', platform: '拼多多', stock: 3, dailySales: 1, daysLeft: 3 },
    { key: '3', name: '充电宝20000mAh', platform: '闲鱼', stock: 12, dailySales: 3, daysLeft: 4 },
    { key: '4', name: '手机壳透明款', platform: '快手', stock: 5, dailySales: 2, daysLeft: 2 },
    { key: '5', name: '数据线快充', platform: '抖音', stock: 2, dailySales: 1, daysLeft: 2 },
    { key: '6', name: '降噪耳机TWS', platform: '拼多多', stock: 6, dailySales: 2, daysLeft: 3 },
    { key: '7', name: '无线充电器', platform: '快手', stock: 4, dailySales: 1, daysLeft: 4 },
  ];

  // 多指标趋势图数据 (转换为长格式)
  const multiLineData = [];
  dailyData.forEach(d => {
    multiLineData.push({ date: d.date, value: d.revenue, category: '营收' });
    multiLineData.push({ date: d.date, value: d.profit, category: '利润' });
    multiLineData.push({ date: d.date, value: d.orders * 100, category: '订单(x100)' });
  });

  // 平台订单趋势数据
  const platformTrendData = [];
  dailyData.forEach(d => {
    const total = d.orders;
    platformTrendData.push({ date: d.date, value: Math.round(total * 0.35), platform: '抖音' });
    platformTrendData.push({ date: d.date, value: Math.round(total * 0.25), platform: '拼多多' });
    platformTrendData.push({ date: d.date, value: Math.round(total * 0.20), platform: '闲鱼' });
    platformTrendData.push({ date: d.date, value: Math.round(total * 0.20), platform: '快手' });
  });

  // 转化漏斗数据
  const funnelPlotData = effectiveFunnelData.map(f => ({
    stage: `${f.stage} (${f.count.toLocaleString()})`,
    count: f.count,
  }));

  /* ─── 图表配置 ─── */

  const multiLineConfig = {
    data: multiLineData,
    xField: 'date',
    yField: 'value',
    seriesField: 'category',
    smooth: true,
    point: { size: 2, shape: 'circle' },
    legend: { position: 'top' },
    color: ['#165DFF', '#00B42A', '#FF7D00'],
    area: { style: { fillOpacity: 0.08 } },
    tooltip: {
      showMarkers: true,
      formatter: (datum) => ({
        name: datum.category,
        value: datum.category === '订单(x100)' ? `${datum.value / 100} 单` : `¥${datum.value.toLocaleString()}`,
      }),
    },
    yAxis: {
      label: {
        formatter: (val) => val >= 10000 ? `${(val / 10000).toFixed(0)}万` : val.toLocaleString(),
      },
    },
    slider: { start: 0, end: 1 },
  };

  const revenueAreaConfig = {
    data: dailyData,
    xField: 'date',
    yField: 'revenue',
    smooth: true,
    line: { color: '#165DFF', lineWidth: 2 },
    area: {
      style: {
        fill: 'l(270) 0:rgba(22,93,255,0.01) 0.5:rgba(22,93,255,0.15) 1:rgba(22,93,255,0.4)',
      },
    },
    point: { size: 3, shape: 'circle', style: { fill: '#165DFF', stroke: '#fff', lineWidth: 2 } },
    tooltip: {
      showMarkers: true,
      formatter: (datum) => ({ name: '营收', value: `¥${datum.revenue.toLocaleString()}` }),
    },
  };

  const platformTrendConfig = {
    data: platformTrendData,
    xField: 'date',
    yField: 'value',
    seriesField: 'platform',
    smooth: true,
    color: ['#165DFF', '#F53F3F', '#FF7D00', '#722ED1'],
    legend: { position: 'top' },
    area: { style: { fillOpacity: 0.05 } },
    line: { lineWidth: 2 },
  };

  const pieConfig = {
    data: effectivePlatformData,
    angleField: 'percentage',
    colorField: 'platform',
    radius: 0.85,
    innerRadius: 0.6,
    label: {
      type: 'inner',
      offset: '-50%',
      content: '{percentage}%',
      style: { textAlign: 'center', fontSize: 14, fontWeight: 600 },
    },
    legend: { position: 'bottom' },
    color: ['#165DFF', '#F53F3F', '#FF7D00', '#722ED1'],
    statistic: {
      title: { style: { fontSize: '12px', color: '#8c8c8c' }, content: '总营收' },
      content: { style: { fontSize: '18px', fontWeight: 600, color: '#165DFF' }, content: formatCurrency(effectivePlatformData.reduce((s, p) => s + p.revenue, 0)) },
    },
    interactions: [{ type: 'element-active' }],
  };

  const topProductsConfig = {
    data: effectiveTopProducts.slice(0, 6),
    xField: 'sales',
    yField: 'name',
    seriesField: 'platform',
    color: ({ platform }) => platformColors[platform] || '#999',
    legend: { position: 'top' },
    barStyle: { radius: [0, 4, 4, 0] },
    label: {
      position: 'right',
      style: { fill: '#666', fontSize: 12 },
      formatter: (datum) => `${datum.sales}件`,
    },
    tooltip: {
      formatter: (datum) => ({
        name: datum.name,
        value: `${datum.sales}件 / ¥${datum.revenue.toLocaleString()}`,
      }),
    },
  };

  const columnConfig = {
    data: dailyData,
    xField: 'date',
    yField: 'orders',
    columnWidthRatio: 0.6,
    columnStyle: {
      radius: [4, 4, 0, 0],
      fill: 'l(270) 0:#74b9ff 1:#165DFF',
    },
    tooltip: {
      formatter: (datum) => ({ name: '订单数', value: `${datum.orders} 单` }),
    },
  };

  /* ─── 平台对比表列 ─── */
  const platformColumns = [
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      render: (text, record) => (
        <Space>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: record.color }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '订单数',
      dataIndex: 'orders',
      key: 'orders',
      align: 'right',
      sorter: (a, b) => a.orders - b.orders,
      render: (val) => <Text>{val.toLocaleString()}</Text>,
    },
    {
      title: '营收',
      dataIndex: 'revenue',
      key: 'revenue',
      align: 'right',
      sorter: (a, b) => a.revenue - b.revenue,
      render: (val) => <Text strong>{formatCurrency(val)}</Text>,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 140,
      render: (val, record) => (
        <Progress
          percent={val}
          size="small"
          strokeColor={record.color}
          format={(p) => `${p}%`}
        />
      ),
    },
    {
      title: '增长',
      dataIndex: 'growth',
      key: 'growth',
      align: 'right',
      sorter: (a, b) => a.growth - b.growth,
      render: (val) => (
        <Text style={{ color: val >= 0 ? '#00B42A' : '#F53F3F' }}>
          {val >= 0 ? <RiseOutlined /> : <FallOutlined />} {Math.abs(val)}%
        </Text>
      ),
    },
  ];

  /* ─── 渲染 ─── */
  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', margin: '-24px', padding: 24 }}>
      {/* 顶部操作栏 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600 }}>工作台</Title>
          <Text type="secondary">数据更新于 {dayjs().format('YYYY-MM-DD HH:mm')}</Text>
          {dataSource === 'api' && (
            <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>实时数据</Tag>
          )}
          {dataSource === 'mock' && (
            <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>演示数据</Tag>
          )}
        </div>
        <Space>
          <Segmented
            value={dateRange}
            onChange={setDateRange}
            options={[
              { label: '今日', value: '1d' },
              { label: '近7天', value: '7d' },
              { label: '近30天', value: '30d' },
            ]}
          />
          <Select
            value={platform}
            onChange={setPlatform}
            style={{ width: 120 }}
            suffixIcon={<ShopOutlined />}
          >
            <Option value="all">全部平台</Option>
            <Option value="douyin">抖音</Option>
            <Option value="pdd">拼多多</Option>
            <Option value="xianyu">闲鱼</Option>
            <Option value="kuaishou">快手</Option>
          </Select>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={handleRefresh}
            loading={refreshing}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="总营收"
            value={totalRevenue}
            prefix={<DollarOutlined />}
            suffix="元"
            color="#165DFF"
            trend={Number(revenueGrowth)}
            trendLabel="较上期"
            loading={loading}
            icon={<DollarOutlined />}
            subValue={`日均 ${formatCurrency(Math.round(totalRevenue / (dailyData.length || 1)))}`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="净利润"
            value={totalProfit}
            prefix={<DollarOutlined />}
            suffix="元"
            color="#00B42A"
            trend={Number(profitGrowth)}
            trendLabel="较上期"
            loading={loading}
            icon={<RiseOutlined />}
            subValue={`利润率 ${profitMargin.toFixed(1)}%`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="订单数"
            value={totalOrders}
            color="#FF7D00"
            trend={Number(ordersGrowth)}
            trendLabel="较上期"
            loading={loading}
            icon={<ShoppingCartOutlined />}
            subValue={`客单价 ¥${avgOrderValue.toFixed(0)}`}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="新增客户"
            value={totalCustomers}
            color="#722ED1"
            trend={Number(customersGrowth)}
            trendLabel="较上期"
            loading={loading}
            icon={<TeamOutlined />}
            subValue="转化率 4.2%"
          />
        </Col>
      </Row>

      {/* 主图表区域 - 多指标趋势 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <BarChartOutlined />
                <span>经营趋势</span>
              </Space>
            }
            extra={
              <Segmented
                size="small"
                value={chartMode}
                onChange={setChartMode}
                options={[
                  { label: '综合趋势', value: 'multi' },
                  { label: '营收趋势', value: 'revenue' },
                  { label: '订单趋势', value: 'orders' },
                ]}
              />
            }
            loading={loading}
          >
            {chartMode === 'multi' && <Line {...multiLineConfig} height={340} />}
            {chartMode === 'revenue' && <Area {...revenueAreaConfig} height={340} />}
            {chartMode === 'orders' && <Column {...columnConfig} height={340} />}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <BarChartOutlined style={{ color: '#165DFF' }} />
                <span>平台营收占比</span>
              </Space>
            }
            loading={loading}
          >
            <Pie {...pieConfig} height={340} />
          </Card>
        </Col>
      </Row>

      {/* 第三行: 热销商品 + 转化漏斗 + 实时订单 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <FireOutlined style={{ color: '#F53F3F' }} />
                <span>热销商品 TOP 6</span>
              </Space>
            }
            extra={<Button type="link" size="small">更多 <RightOutlined /></Button>}
            loading={loading}
          >
            <Column {...topProductsConfig} height={320} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <EyeOutlined style={{ color: '#722ED1' }} />
                <span>转化漏斗</span>
              </Space>
            }
            loading={loading}
          >
            <Funnel
              data={funnelPlotData}
              xField="stage"
              yField="count"
              color={['#165DFF', '#36cfc9', '#597ef7', '#adc6ff', '#d6e4ff']}
              label={{
                position: 'inside',
                style: { fill: '#fff', fontSize: 13, fontWeight: 500 },
              }}
              legend={false}
              height={320}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <RealtimeOrderFeed orders={effectiveRealtimeOrders} />
        </Col>
      </Row>

      {/* 第四行: 平台趋势 + 待办事项 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <SyncOutlined style={{ color: '#165DFF' }} />
                <span>平台订单趋势</span>
              </Space>
            }
            loading={loading}
          >
            <Column {...platformTrendConfig} height={280} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#FF7D00' }} />
                <span>待办事项</span>
                <Tag color="orange">{effectiveTodoData.reduce((s, t) => s + t.count, 0)}</Tag>
              </Space>
            }
            extra={<Button type="link" size="small">全部 <RightOutlined /></Button>}
          >
            <List
              dataSource={effectiveTodoData}
              renderItem={(item) => (
                <List.Item
                  style={{ padding: '10px 0' }}
                  actions={[
                    <Button key="go" type="link" size="small" style={{ color: '#165DFF' }}>
                      去处理 <RightOutlined />
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={item.icon}
                        style={{ backgroundColor: item.color }}
                        size={40}
                      />
                    }
                    title={
                      <Space>
                        <Text>{item.title}</Text>
                        {item.urgency === 'high' && <Tag color="red" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>紧急</Tag>}
                      </Space>
                    }
                    description={`${item.count} 条待处理`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 第五行: 平台对比表 + 预警信息 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <ShopOutlined style={{ color: '#165DFF' }} />
                <span>平台经营对比</span>
              </Space>
            }
          >
            <Table
              columns={platformColumns}
              dataSource={effectivePlatformData}
              pagination={false}
              size="middle"
              rowKey="platform"
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <ExclamationCircleOutlined style={{ color: '#F53F3F' }} />
                <span>预警信息</span>
                <Badge count={alertData.filter(a => a.type !== 'info').length} size="small" />
              </Space>
            }
            extra={<Button type="link" size="small">全部 <RightOutlined /></Button>}
          >
            <List
              dataSource={effectiveAlertData}
              renderItem={(item) => (
                <List.Item style={{ padding: '10px 0' }} actions={[<Button key="act" type="link" size="small">{item.action}</Button>]}>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={
                          item.type === 'error' ? <WarningOutlined /> :
                          item.type === 'warning' ? <ExclamationCircleOutlined /> :
                          <CheckCircleOutlined />
                        }
                        style={{
                          backgroundColor: item.type === 'error' ? '#fff1f0' :
                                          item.type === 'warning' ? '#fff7e6' : '#e6f4ff',
                          color: item.type === 'error' ? '#F53F3F' :
                                item.type === 'warning' ? '#FF7D00' : '#165DFF',
                        }}
                        size={36}
                      />
                    }
                    title={<Text strong>{item.title}</Text>}
                    description={
                      <div>
                        <div>{item.content}</div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{item.time}</Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 底部: 库存预警 */}
      <Card
        title={
          <Space>
            <InboxOutlined style={{ color: '#FF7D00' }} />
            <span>库存预警</span>
            <Tag color="orange">{effectiveLowStock.length}件</Tag>
          </Space>
        }
        extra={<Button type="link">查看全部库存 <RightOutlined /></Button>}
      >
        <Table
          columns={[
            {
              title: '商品',
              dataIndex: 'name',
              key: 'name',
              render: (text) => <Text strong>{text}</Text>,
            },
            {
              title: '平台',
              dataIndex: 'platform',
              key: 'platform',
              render: (text) => <Tag color={platformColors[text]}>{text}</Tag>,
            },
            {
              title: '库存',
              dataIndex: 'stock',
              key: 'stock',
              sorter: (a, b) => a.stock - b.stock,
              render: (val) => (
                <Text style={{ color: val < 5 ? '#F53F3F' : val < 10 ? '#FF7D00' : '#00B42A', fontWeight: 600 }}>
                  {val}
                </Text>
              ),
            },
            {
              title: '日均销量',
              dataIndex: 'dailySales',
              key: 'dailySales',
            },
            {
              title: '预计可售',
              dataIndex: 'daysLeft',
              key: 'daysLeft',
              sorter: (a, b) => a.daysLeft - b.daysLeft,
              render: (val) => (
                <Space>
                  <Progress
                    percent={Math.min(val / 14 * 100, 100)}
                    steps={5}
                    size="small"
                    strokeColor={val < 3 ? '#F53F3F' : val < 7 ? '#FF7D00' : '#00B42A'}
                    showInfo={false}
                    style={{ width: 60 }}
                  />
                  <Text style={{ color: val < 3 ? '#F53F3F' : val < 7 ? '#FF7D00' : '#00B42A' }}>
                    {val}天
                  </Text>
                </Space>
              ),
            },
            {
              title: '操作',
              key: 'action',
              render: (_, record) => (
                <Space>
                  <Button type="primary" size="small" ghost>补货</Button>
                  <Button type="link" size="small">详情</Button>
                </Space>
              ),
            },
          ]}
          dataSource={effectiveLowStock}
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
}
