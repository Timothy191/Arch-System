---
name: file-management-yazi
description: Modern asynchronous terminal file management, instant preview, and high-performance navigation on Arch Linux and Wayland/Hyprland utilizing Yazi, Eza, and Broot.
---

# High-Performance Terminal File Management on Arch Linux (Yazi + Eza + Broot)

## Overview

For **Omarchy Linux (Arch rolling under Hyprland/Wayland)**, terminal file management is optimized through an asynchronous Rust-native stack:

- **`yazi`**: Primary full-screen async terminal file manager with Wayland/GPU image preview and non-blocking I/O.
- **`eza`**: High-speed, colorful directory and metadata listing replacement for `ls`.
- **`broot`**: Interactive tree-oriented fuzzy navigation for large monorepo discovery.

---

## 1. Operating System File Manager Comparison

| Tool        | Language | Architecture                 |    Wayland / Hyprland Support    | Monorepo Performance (100k+ files) | Verdict for Omarchy Linux      |
| :---------- | :------- | :--------------------------- | :------------------------------: | :--------------------------------: | :----------------------------- |
| **`yazi`**  | **Rust** | **Async (Tokio) Event Loop** | **Native (Sixel/Kitty/Wayland)** |     **Instant (Zero freeze)**      | 🥇 **BEST OVERALL**            |
| **`broot`** | **Rust** | **Tree Graph & Fuzzy Index** |            **Native**            |            **Instant**             | 🥈 **Best for Tree Discovery** |
| **`eza`**   | **Rust** | **Fast Synchronous List**    |            **Native**            |            **Instant**             | 🥉 **Best for Terminal `ls`**  |
| `superfile` | Go       | Multi-pane TUI               |             Standard             |              Moderate              | Good alternative               |
| `ranger`    | Python   | Synchronous single-thread    |          Slower preview          |  Noticeable lag on `node_modules`  | Legacy                         |
| `lf`        | Go       | Single-thread server/client  |              Basic               |                Fast                | Good lightweight choice        |

---

## 2. Command Quick Reference

```bash
# Launch full-screen async file manager
yazi

# Tree-view exploration with fuzzy search
broot

# Extended metadata directory listing with git status
eza -lah --git --icons
```
