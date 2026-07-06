# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed

- **切换标签页计时状态重置**：切换「计时/历史」标签时 TimerPage 卸载重挂导致 useTimer() state 全部丢失。将 useTimer() 上提到 App 组件，计时状态不再随标签切换销毁。
  - `App.jsx` — 引入并调用 `useTimer()`，将 timer 对象传入 TimerPage
  - `TimerPage.jsx` — 改为接收 timer prop，不再自建 useTimer 实例
