#!/usr/bin/env python3
"""
generate_resource_donut_chart.py
Renders publication-grade Donut/Pie charts visualizing hardware resource consumption
comparing WebGPU WGSL Pipeline vs CPU WASM Fallback:
1. 2-Donut Chart: Direct 1-to-1 comparison of CPU Usage and RAM Footprint.
2. 3-Donut Chart: UI Thread Capacity (WebGPU vs WASM) + RAM Allocation.
"""

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.lines import Line2D

def render_direct_2donut_chart():
    """Generates the direct 2-Donut comparison matching the bar chart metrics."""
    plt.rcParams['font.family'] = 'DejaVu Sans'
    plt.rcParams['font.size'] = 11

    c_webgpu = '#00B074'   # Vibrant Emerald Green
    c_wasm = '#F59E0B'     # Warm Amber Orange
    c_bg = '#FFFFFF'       # Clean presentation white
    c_banner_bg = '#F0FDF4' # Light mint card
    c_banner_edge = '#10B981'
    c_text_dark = '#0F172A'
    c_text_muted = '#475569'

    fig = plt.figure(figsize=(16, 9.5), dpi=300, facecolor=c_bg)

    # 1. Header Titles
    fig.text(0.5, 0.94, "Client Hardware Resource Consumption", 
             fontsize=22, weight='bold', color=c_text_dark, ha='center')
    fig.text(0.5, 0.90, "(Lightweight footprint prevents browser UI thread locking)", 
             fontsize=13.5, weight='normal', color=c_text_muted, ha='center')

    # 2. Top Hardware Highlight Banner Box
    ax_banner = fig.add_axes([0.12, 0.76, 0.76, 0.11])
    ax_banner.set_facecolor(c_banner_bg)
    for spine in ax_banner.spines.values():
        spine.set_edgecolor(c_banner_edge)
        spine.set_linewidth(1.8)
    ax_banner.set_xticks([])
    ax_banner.set_yticks([])

    ax_banner.text(0.03, 0.74, "HARDWARE HIGHLIGHT:", 
                   fontsize=12, weight='bold', color='#047857', va='center')
    ax_banner.text(0.03, 0.32, 
                   "• Only 4.8% CPU used (vs 88.5% on CPU WASM fallback)\n"
                   "• 19.6x speedup on WebGPU compute shaders\n"
                   "• Zero page freezing, laptop stays cool & responsive", 
                   fontsize=11, color='#065F46', va='center', linespacing=1.35)

    # Right side stat pill inside banner
    ax_banner.text(0.88, 0.50, "19.6x\nFASTER", 
                   fontsize=14, weight='bold', color='#047857', 
                   ha='center', va='center', 
                   bbox=dict(boxstyle='round,pad=0.5', facecolor='#D1FAE5', edgecolor='#10B981', lw=1.2))

    # 3. Subplot 1: CPU Usage Donut
    ax1 = fig.add_axes([0.08, 0.17, 0.38, 0.50])
    cpu_values = [4.8, 88.5]
    colors = [c_webgpu, c_wasm]
    explode = (0.06, 0)
    
    wedges1, texts1 = ax1.pie(
        cpu_values, 
        explode=explode,
        startangle=110,
        colors=colors,
        wedgeprops=dict(width=0.36, edgecolor='white', linewidth=3)
    )

    # Center text inside Donut 1
    ax1.text(0, 0.12, "CPU LOAD", ha='center', va='center', fontsize=13, weight='bold', color=c_text_dark)
    ax1.text(0, -0.04, "WebGPU: 4.8%\nWASM: 88.5%", ha='center', va='center', fontsize=10.5, color=c_text_muted, linespacing=1.2)
    ax1.text(0, -0.22, "18.4x Lower", ha='center', va='center', fontsize=11, weight='bold', color='#047857')

    ax1.set_title("CPU Usage (%)\nWebGPU WGSL (4.8%) vs CPU WASM (88.5%)", 
                  fontsize=13.5, weight='bold', color=c_text_dark, pad=15)

    # Distinct Callout Cards above and below Donut 1
    ax1.text(0, 1.22, "WebGPU WGSL: 4.8% CPU (5.1% share)", 
             fontsize=10.5, weight='bold', color='#047857', ha='center',
             bbox=dict(boxstyle='round,pad=0.45', facecolor='#ECFDF5', edgecolor='#10B981', lw=1))
    
    ax1.text(0, -1.22, "CPU WASM Fallback: 88.5% CPU (94.9% share)", 
             fontsize=10.5, weight='bold', color='#B45309', ha='center',
             bbox=dict(boxstyle='round,pad=0.45', facecolor='#FEF3C7', edgecolor='#F59E0B', lw=1))

    # Inner wedge labels (calculated accurately to avoid edge overlap)
    ax1.annotate("5.1%", xy=(-0.42, 0.72), xytext=(-0.75, 0.85),
                 arrowprops=dict(arrowstyle="->", color='#047857', lw=1.5),
                 color='#047857', weight='bold', fontsize=12, ha='center', va='center')
    ax1.text(0.40, -0.68, "94.9%", color='white', weight='bold', fontsize=14, ha='center', va='center')

    # 4. Subplot 2: Browser RAM Donut
    ax2 = fig.add_axes([0.54, 0.17, 0.38, 0.50])
    ram_values = [38.5, 124.0]
    explode_ram = (0.06, 0)

    wedges2, texts2 = ax2.pie(
        ram_values, 
        explode=explode_ram,
        startangle=110,
        colors=colors,
        wedgeprops=dict(width=0.36, edgecolor='white', linewidth=3)
    )

    # Center text inside Donut 2
    ax2.text(0, 0.12, "RAM FOOTPRINT", ha='center', va='center', fontsize=13, weight='bold', color=c_text_dark)
    ax2.text(0, -0.04, "WebGPU: 38.5 MB\nWASM: 124.0 MB", ha='center', va='center', fontsize=10.5, color=c_text_muted, linespacing=1.2)
    ax2.text(0, -0.22, "3.2x Lighter", ha='center', va='center', fontsize=11, weight='bold', color='#047857')

    ax2.set_title("Browser RAM Overhead (MB)\nWebGPU WGSL (38.5 MB) vs CPU WASM (124.0 MB)", 
                  fontsize=13.5, weight='bold', color=c_text_dark, pad=15)

    # Distinct Callout Cards above and below Donut 2
    ax2.text(0, 1.22, "WebGPU WGSL: 38.5 MB (23.7% share)", 
             fontsize=10.5, weight='bold', color='#047857', ha='center',
             bbox=dict(boxstyle='round,pad=0.45', facecolor='#ECFDF5', edgecolor='#10B981', lw=1))
    
    ax2.text(0, -1.22, "CPU WASM Fallback: 124.0 MB (76.3% share)", 
             fontsize=10.5, weight='bold', color='#B45309', ha='center',
             bbox=dict(boxstyle='round,pad=0.45', facecolor='#FEF3C7', edgecolor='#F59E0B', lw=1))

    # Inner wedge percentage labels cleanly positioned at mid-radius
    ax2.text(-0.70, 0.40, "23.7%", color='white', weight='bold', fontsize=12, ha='center', va='center')
    ax2.text(0.70, -0.38, "76.3%", color='white', weight='bold', fontsize=14, ha='center', va='center')

    # 5. Shared Legend at Bottom
    legend_elements = [
        Line2D([0], [0], marker='s', color='w', label='WebGPU WGSL Pipeline (Hardware Accelerated)',
               markerfacecolor=c_webgpu, markersize=14),
        Line2D([0], [0], marker='s', color='w', label='CPU WASM Fallback (Standard Browser Runtime)',
               markerfacecolor=c_wasm, markersize=14)
    ]
    fig.legend(handles=legend_elements, loc='lower center', ncol=2, 
               frameon=True, facecolor='#F8FAFC', edgecolor='#CBD5E1', 
               fontsize=11.5, bbox_to_anchor=(0.5, 0.04))

    out_path = "docs/resource_consumption_donut_chart.png"
    plt.savefig(out_path, dpi=300, bbox_inches='tight', facecolor=c_bg)
    plt.close()
    print(f"Saved: {out_path}")


def render_capacity_trio_donut_chart():
    """Generates 3 Donut charts showing:
       1. WebGPU CPU Thread Capacity (4.8% used vs 95.2% free)
       2. CPU WASM Thread Capacity (88.5% choked vs 11.5% free)
       3. Memory Footprint Share (38.5 MB vs 124.0 MB)
    """
    plt.rcParams['font.family'] = 'DejaVu Sans'
    plt.rcParams['font.size'] = 11

    c_webgpu = '#00B074'   # Emerald Green
    c_wasm = '#EF4444'     # Red/Coral for heavy thread choke
    c_free = '#E2E8F0'     # Soft neutral gray for free CPU
    c_bg = '#FFFFFF'
    c_text_dark = '#0F172A'
    c_text_muted = '#475569'

    fig = plt.figure(figsize=(17, 9.5), dpi=300, facecolor=c_bg)

    # 1. Header
    fig.text(0.5, 0.94, "Client Hardware Thread Capacity & Footprint", 
             fontsize=22, weight='bold', color=c_text_dark, ha='center')
    fig.text(0.5, 0.90, "How WebGPU offloading preserves 95.2% of browser UI responsiveness", 
             fontsize=13.5, weight='normal', color=c_text_muted, ha='center')

    # 2. Highlight Banner
    ax_banner = fig.add_axes([0.10, 0.76, 0.80, 0.11])
    ax_banner.set_facecolor('#F0FDF4')
    for spine in ax_banner.spines.values():
        spine.set_edgecolor('#10B981')
        spine.set_linewidth(1.8)
    ax_banner.set_xticks([])
    ax_banner.set_yticks([])

    ax_banner.text(0.02, 0.74, "HARDWARE HIGHLIGHT:", 
                   fontsize=12, weight='bold', color='#047857', va='center')
    ax_banner.text(0.02, 0.32, 
                   "• Only 4.8% CPU used by WebGPU shaders (vs 88.5% choked on CPU WASM)\n"
                   "• 95.2% of browser main thread left completely idle for 60 FPS user interaction\n"
                   "• Browser RAM reduced from 124.0 MB down to 38.5 MB (3.2x memory reduction)", 
                   fontsize=11, color='#065F46', va='center', linespacing=1.35)
    
    ax_banner.text(0.88, 0.50, "95.2%\nFREE CPU", 
                   fontsize=14, weight='bold', color='#047857', 
                   ha='center', va='center', 
                   bbox=dict(boxstyle='round,pad=0.5', facecolor='#D1FAE5', edgecolor='#10B981', lw=1.2))

    # Donut 1: WebGPU CPU Capacity
    ax1 = fig.add_axes([0.05, 0.18, 0.28, 0.50])
    ax1.pie([4.8, 95.2], colors=[c_webgpu, c_free], startangle=90,
            wedgeprops=dict(width=0.35, edgecolor='white', linewidth=2.5))
    ax1.text(0, 0.12, "4.8%", ha='center', va='center', fontsize=20, weight='bold', color='#047857')
    ax1.text(0, -0.06, "CPU Used", ha='center', va='center', fontsize=11, weight='bold', color=c_text_dark)
    ax1.text(0, -0.22, "95.2% Free UI Headroom", ha='center', va='center', fontsize=9.5, color='#059669', weight='bold')
    ax1.set_title("WebGPU WGSL Pipeline\n(Thread Capacity: 100%)", fontsize=13, weight='bold', color=c_text_dark, pad=15)
    ax1.text(0, -1.25, "Leaves browser UI thread\ncompletely smooth & responsive", 
             ha='center', va='center', fontsize=10.5, color='#047857', weight='bold')

    # Donut 2: CPU WASM Capacity
    ax2 = fig.add_axes([0.36, 0.18, 0.28, 0.50])
    ax2.pie([88.5, 11.5], colors=[c_wasm, c_free], startangle=90,
            wedgeprops=dict(width=0.35, edgecolor='white', linewidth=2.5))
    ax2.text(0, 0.12, "88.5%", ha='center', va='center', fontsize=20, weight='bold', color='#DC2626')
    ax2.text(0, -0.06, "CPU Used", ha='center', va='center', fontsize=11, weight='bold', color=c_text_dark)
    ax2.text(0, -0.22, "Only 11.5% Headroom", ha='center', va='center', fontsize=9.5, color='#DC2626', weight='bold')
    ax2.set_title("CPU WASM Fallback\n(Thread Capacity: 100%)", fontsize=13, weight='bold', color=c_text_dark, pad=15)
    ax2.text(0, -1.25, "Chokes browser UI thread,\ncausing page jitter & tab freezes", 
             ha='center', va='center', fontsize=10.5, color='#DC2626', weight='bold')

    # Donut 3: RAM Footprint Share
    ax3 = fig.add_axes([0.67, 0.18, 0.28, 0.50])
    ax3.pie([38.5, 124.0],
            colors=[c_webgpu, '#F59E0B'], startangle=110,
            wedgeprops=dict(width=0.35, edgecolor='white', linewidth=2.5))
    
    # Custom wedge labels positioned with precise polar coordinates
    ax3.text(-0.70, 0.40, "23.7%", color='white', weight='bold', fontsize=12, ha='center', va='center')
    ax3.text(0.70, -0.38, "76.3%", color='white', weight='bold', fontsize=13, ha='center', va='center')

    ax3.text(0, 0.12, "38.5 MB", ha='center', va='center', fontsize=18, weight='bold', color='#047857')
    ax3.text(0, -0.06, "vs 124.0 MB", ha='center', va='center', fontsize=11, weight='bold', color=c_text_dark)
    ax3.text(0, -0.22, "3.2x Lighter Footprint", ha='center', va='center', fontsize=9.5, color='#047857', weight='bold')
    ax3.set_title("Browser RAM Allocation\n(Client Memory: 162.5 MB)", fontsize=13, weight='bold', color=c_text_dark, pad=15)
    ax3.text(0, -1.25, "Minimal memory footprint\nsuitable for low-end laptops", 
             ha='center', va='center', fontsize=10.5, color='#047857', weight='bold')

    # Bottom Legend
    legend_elements = [
        Line2D([0], [0], marker='s', color='w', label='WebGPU WGSL Pipeline (Hardware Accelerated)',
               markerfacecolor=c_webgpu, markersize=14),
        Line2D([0], [0], marker='s', color='w', label='CPU WASM Fallback (Heavy Compute Choke)',
               markerfacecolor=c_wasm, markersize=14),
        Line2D([0], [0], marker='s', color='w', label='Free Browser UI Capacity (Idle Headroom)',
               markerfacecolor=c_free, markersize=14),
    ]
    fig.legend(handles=legend_elements, loc='lower center', ncol=3, 
               frameon=True, facecolor='#F8FAFC', edgecolor='#CBD5E1', 
               fontsize=11.5, bbox_to_anchor=(0.5, 0.04))

    out_path = "docs/resource_capacity_trio_donut_chart.png"
    plt.savefig(out_path, dpi=300, bbox_inches='tight', facecolor=c_bg)
    plt.close()
    print(f"Saved: {out_path}")

if __name__ == "__main__":
    render_direct_2donut_chart()
    render_capacity_trio_donut_chart()
