#!/usr/bin/env python3
"""
generate_impact_benefits_quadrant_charts.py
Renders the two specialized benchmark charts for the bottom-right quadrant of the
Impact & Benefits slide using Seaborn & Matplotlib:
1. Risk Reduction and Compliance Improvement (Dual-axis Bar + Line Chart)
2. Breakdown of Investigation & Workflow Time (Stacked Bar Chart with 27ms badge)
"""

import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def generate_compliance_risk_chart():
    # Set Seaborn theme
    sns.set_theme(style="whitegrid", font="DejaVu Sans")
    
    fig, ax1 = plt.subplots(figsize=(7.2, 4.8), dpi=300, facecolor='#FFFFFF')
    ax1.set_facecolor('#FFFFFF')

    stages = ['Month 1\n(Baseline)', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6\n(GUPTCHARA)']
    x = np.arange(len(stages))
    bar_width = 0.38

    # Data: Privacy Breach Risk dropping from 92% to 1%, Compliance rising from 22% to 100%
    risk_values = [92.0, 70.0, 46.0, 24.0, 10.0, 1.0]           # Inherent breach risk %
    compliance_values = [22.0, 48.0, 72.0, 88.0, 96.0, 100.0]   # DPDP & GDPR compliance %

    # Bar chart for Breach Risk (Seaborn palette accent blue)
    bars = ax1.bar(x - bar_width/2, risk_values, width=bar_width, 
                   color='#2563EB', label='Breach Risk (%)', edgecolor='none', zorder=3, alpha=0.92)
    ax1.set_ylabel('Inherent Breach Risk (%)', color='#1D4ED8', fontsize=10.5, weight='bold', labelpad=6)
    ax1.tick_params(axis='y', labelcolor='#1D4ED8', labelsize=9)
    ax1.set_ylim(0, 122)
    ax1.grid(axis='y', linestyle='--', alpha=0.35, zorder=0)
    ax1.grid(axis='x', visible=False)

    # Add bar value labels
    for bar in bars:
        h = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2, h + 2.5, f"{int(h)}%", 
                 ha='center', va='bottom', fontsize=8.5, color='#1D4ED8', weight='bold')

    # Twin axis for Compliance Improvement (Vibrant Red line)
    ax2 = ax1.twinx()
    line = ax2.plot(x + bar_width/2, compliance_values, color='#DC2626', 
                    marker='o', markersize=7, linewidth=2.6, 
                    label='DPDP Compliance (%)', zorder=4)
    ax2.set_ylabel('Regulatory Compliance (%)', color='#B91C1C', fontsize=10.5, weight='bold', labelpad=6)
    ax2.tick_params(axis='y', labelcolor='#B91C1C', labelsize=9)
    ax2.set_ylim(0, 122)
    ax2.grid(False)

    # Add line value labels with white background halo to prevent collision
    for i, val in enumerate(compliance_values):
        ax2.text(x[i] + bar_width/2, val + 3.6, f"{int(val)}%", 
                 ha='center', va='bottom', fontsize=8.5, color='#B91C1C', weight='bold',
                 bbox=dict(boxstyle='square,pad=0.15', facecolor='#FFFFFF', edgecolor='none', alpha=0.85))

    ax1.set_xticks(x)
    ax1.set_xticklabels(stages, fontsize=8.5, weight='bold', color='#0F172A')

    # Title
    fig.suptitle('❖ Risk Reduction and Compliance Improvement', 
                 fontsize=12, weight='bold', color='#0F172A', y=0.98)

    # Highlight Callout Banner at top
    ax1.text(0.5, 1.04, "Breach Risk Slashed: 92% → 1%  |  DPDP Compliance: 22% → 100%", 
             transform=ax1.transAxes, ha='center', va='bottom',
             fontsize=8.5, weight='bold', color='#047857',
             bbox=dict(boxstyle='round,pad=0.35', facecolor='#ECFDF5', edgecolor='#10B981', lw=1.1))

    # Combined Legend with generous bottom clearance
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper center', 
               bbox_to_anchor=(0.5, -0.16), ncol=2, frameon=True, 
               facecolor='#F8FAFC', edgecolor='#CBD5E1', fontsize=9)

    sns.despine(top=True, right=False, left=False, bottom=False)
    plt.tight_layout(rect=[0, 0.05, 1, 1])
    out_path = 'docs/impact_compliance_risk_chart.png'
    plt.savefig(out_path, dpi=300, bbox_inches='tight', facecolor='#FFFFFF')
    plt.close()
    print(f"Saved: {out_path}")


def generate_time_breakdown_chart():
    # Set Seaborn theme
    sns.set_theme(style="whitegrid", font="DejaVu Sans")

    fig, ax = plt.subplots(figsize=(7.2, 4.8), dpi=300, facecolor='#FFFFFF')
    ax.set_facecolor('#FFFFFF')

    stages = ['Month 1\n(Baseline)', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6\n(GUPTCHARA)']
    x = np.arange(len(stages))
    bar_width = 0.48

    # Stacked components of weekly workflow hours:
    # Manual review drops from 24h -> 4h (83% reduction!)
    # Total workflow drops from 42h -> 7.5h (5.6x faster!)
    manual_review = np.array([24.0, 16.0, 11.0, 7.5, 5.0, 4.0])    # Blue: Manual PII verification
    expert_analysis = np.array([12.0, 9.0, 6.5, 4.5, 3.0, 2.0])    # Orange: Edge-case resolution
    edge_redaction = np.array([6.0, 3.0, 2.0, 1.8, 1.6, 1.5])      # Green: On-device agent runtime (27ms/step)

    # Stacked Bars using Seaborn colors
    p1 = ax.bar(x, manual_review, bar_width, label='Manual Review (Hours)', color='#2563EB', zorder=3, alpha=0.92)
    p2 = ax.bar(x, expert_analysis, bar_width, bottom=manual_review, label='Expert Analysis (Hours)', color='#F59E0B', zorder=3, alpha=0.92)
    p3 = ax.bar(x, edge_redaction, bar_width, bottom=manual_review + expert_analysis, label='On-Device Agent Time', color='#10B981', zorder=3, alpha=0.92)

    # Annotate total hours and reduction on top of bars
    totals = manual_review + expert_analysis + edge_redaction
    for i, total in enumerate(totals):
        if i == 0:
            label = "42.0h Total\n(Baseline)"
        elif i == len(totals) - 1:
            label = f"{total:.1f}h Total\n(-82% Time)"
        else:
            label = f"{total:.1f}h"
        ax.text(x[i], total + 1.0, label, 
                ha='center', va='bottom', fontsize=8, weight='bold', color='#0F172A')

    # Add high-visibility Callout Box for "27ms on-device redaction" and "83% review reduction"
    ax.text(0.5, 1.04, "⚡ On-Device Masking: 27ms / step  |  Human Review: 24h → 4h (-83%)", 
            transform=ax.transAxes, ha='center', va='bottom',
            fontsize=8.5, weight='bold', color='#1E40AF',
            bbox=dict(boxstyle='round,pad=0.35', facecolor='#EFF6FF', edgecolor='#3B82F6', lw=1.1))

    ax.set_ylabel('Weekly Workflow Hours', fontsize=10.5, weight='bold', color='#0F172A', labelpad=6)
    ax.set_ylim(0, 53)
    ax.grid(axis='y', linestyle='--', alpha=0.35, zorder=0)
    ax.grid(axis='x', visible=False)

    ax.set_xticks(x)
    ax.set_xticklabels(stages, fontsize=8.5, weight='bold', color='#0F172A')

    fig.suptitle('❖ Breakdown of Workflow Time & Automation', 
                 fontsize=12, weight='bold', color='#0F172A', y=0.98)

    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.16), ncol=3, 
              frameon=True, facecolor='#F8FAFC', edgecolor='#CBD5E1', fontsize=8.5)

    sns.despine(top=True, right=True, left=False, bottom=False)
    plt.tight_layout(rect=[0, 0.05, 1, 1])
    out_path = 'docs/impact_time_breakdown_chart.png'
    plt.savefig(out_path, dpi=300, bbox_inches='tight', facecolor='#FFFFFF')
    plt.close()
    print(f"Saved: {out_path}")


if __name__ == '__main__':
    generate_compliance_risk_chart()
    generate_time_breakdown_chart()
