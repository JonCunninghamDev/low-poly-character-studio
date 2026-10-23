"""Reusable low-poly presentation/shape variants for the Chibi style kit.

The generator first creates the proven Gold Standard character. This module then
resolves selected named variants by replacing only the relevant mesh while
preserving rig-facing object names. That keeps the existing skinning and export
contracts stable while allowing the Studio to assemble intentional visual parts.
"""

from __future__ import annotations

import math

import bpy

from .style_kit import resolved_source_parts, validate_style_configuration


PART_LIBRARY_SCHEMA = "chibi-part-library/v1"


def _lowpoly(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_flat()
    obj.select_set(False)


def _material_from(obj: bpy.types.Object):
    if not obj.data.materials:
        raise ValueError(f"{obj.name} must contain a material before style-part replacement")
    return obj.data.materials[0]


def _remove(obj: bpy.types.Object) -> None:
    mesh = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)


def _mesh_object(name: str, vertices, faces, material) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    _lowpoly(obj)
    return obj


def _tag(obj: bpy.types.Object, slot_id: str, variant_id: str, source_id: str) -> None:
    obj["partLibrarySchema"] = PART_LIBRARY_SCHEMA
    obj["styleKitSlot"] = slot_id
    obj["styleVariantId"] = variant_id
    obj["styleSourceId"] = source_id


def _append_box(vertices, faces, center, dimensions) -> None:
    cx, cy, cz = center
    hx, hy, hz = (dimension / 2 for dimension in dimensions)
    start = len(vertices)
    vertices.extend(
        (
            (cx - hx, cy - hy, cz - hz),
            (cx + hx, cy - hy, cz - hz),
            (cx + hx, cy + hy, cz - hz),
            (cx - hx, cy + hy, cz - hz),
            (cx - hx, cy - hy, cz + hz),
            (cx + hx, cy - hy, cz + hz),
            (cx + hx, cy + hy, cz + hz),
            (cx - hx, cy + hy, cz + hz),
        )
    )
    faces.extend(
        (
            (start + 0, start + 1, start + 2, start + 3),
            (start + 4, start + 7, start + 6, start + 5),
            (start + 0, start + 4, start + 5, start + 1),
            (start + 1, start + 5, start + 6, start + 2),
            (start + 2, start + 6, start + 7, start + 3),
            (start + 4, start + 0, start + 3, start + 7),
        )
    )


def _head_mesh(dna, variant_id: str, material) -> bpy.types.Object:
    sx, sy, sz = dna.head_scale
    segments = dna.low_poly_segments
    if variant_id == "broad-cheek":
        rings = (
            (-1.00, 0.42, 0.38),
            (-0.78, 0.68, 0.61),
            (-0.46, 1.02, 0.84),
            (-0.12, 1.08, 0.98),
            (0.24, 0.99, 1.00),
            (0.62, 0.82, 0.90),
            (0.92, 0.48, 0.54),
        )
    elif variant_id == "tapered":
        rings = (
            (-1.00, 0.34, 0.36),
            (-0.78, 0.57, 0.58),
            (-0.46, 0.82, 0.80),
            (-0.12, 0.93, 0.94),
            (0.24, 1.00, 1.00),
            (0.62, 0.88, 0.92),
            (0.92, 0.52, 0.56),
        )
    else:
        raise ValueError(f"No reusable head mesh implementation for {variant_id!r}")

    vertices = []
    for z_norm, x_mul, y_mul in rings:
        for index in range(segments):
            angle = math.tau * index / segments
            x = math.cos(angle) * sx * x_mul
            y = math.sin(angle) * sy * y_mul
            if y < 0:
                y *= 0.86
            vertices.append((x, y, dna.head_center_z + z_norm * sz))

    top_index = len(vertices)
    vertices.append((0, 0, dna.head_center_z + 1.05 * sz))
    bottom_index = len(vertices)
    vertices.append((0, -0.02 * sy, dna.head_center_z - 1.08 * sz))
    faces = []
    for ring_index in range(len(rings) - 1):
        for index in range(segments):
            a = ring_index * segments + index
            b = ring_index * segments + (index + 1) % segments
            c = (ring_index + 1) * segments + (index + 1) % segments
            d = (ring_index + 1) * segments + index
            faces.append((a, b, c, d))
    top_ring_start = (len(rings) - 1) * segments
    for index in range(segments):
        faces.append((top_ring_start + index, top_ring_start + (index + 1) % segments, top_index))
        faces.append((bottom_index, (index + 1) % segments, index))
    return _mesh_object("Body_Head", vertices, faces, material)


def _eye(name: str, x: float, dna, variant_id: str, material) -> bpy.types.Object:
    front_y = -dna.head_depth * 0.42 - dna.head_depth * 0.012
    if variant_id == "round":
        width = dna.eye_height * 0.64
        height = width
    elif variant_id == "narrow":
        width = dna.eye_height * 0.72
        height = dna.eye_height * 0.46
    else:
        raise ValueError(f"No reusable eye implementation for {variant_id!r}")
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=8,
        ring_count=4,
        radius=1,
        location=(x, front_y, dna.eye_center_z),
    )
    eye = bpy.context.object
    eye.name = name
    eye.scale = (width / 2, dna.head_depth * 0.018, height / 2)
    eye.data.materials.append(material)
    _lowpoly(eye)
    return eye


def _side_swept_hair(dna, material) -> bpy.types.Object:
    sx, sy, sz = dna.head_scale
    segments = dna.low_poly_segments
    ring_specs = (
        (0.03, 1.04, 1.03),
        (0.41, 1.03, 1.04),
        (0.73, 0.88, 0.92),
    )
    vertices = []
    for ring_index, (z_norm, x_mul, y_mul) in enumerate(ring_specs):
        for index in range(segments):
            angle = math.tau * index / segments
            x = math.cos(angle) * sx * x_mul
            y = math.sin(angle) * sy * y_mul
            local_z = z_norm
            if ring_index == 0 and y < 0:
                sweep = (x / max(sx, 1e-6) + 1.0) * 0.5
                local_z -= 0.10 + 0.28 * sweep
            elif ring_index == 0:
                local_z -= 0.015
            vertices.append((x, y, dna.head_center_z + local_z * sz))
    top_index = len(vertices)
    vertices.append((0, 0, dna.head_center_z + 1.055 * sz))
    faces = []
    for ring_index in range(len(ring_specs) - 1):
        for index in range(segments):
            a = ring_index * segments + index
            b = ring_index * segments + (index + 1) % segments
            c = (ring_index + 1) * segments + (index + 1) % segments
            d = (ring_index + 1) * segments + index
            faces.append((a, b, c, d))
    top_ring_start = (len(ring_specs) - 1) * segments
    for index in range(segments):
        faces.append((top_ring_start + index, top_ring_start + (index + 1) % segments, top_index))
    return _mesh_object("Hair_Cap", vertices, faces, material)


def _soft_smile(dna, material) -> bpy.types.Object:
    front_y = -dna.head_depth * 0.425 - 0.004
    center_z = dna.eye_center_z - dna.head_height * 0.245
    half_width = dna.head_width * 0.07
    lift = dna.head_height * 0.026
    band = dna.head_height * 0.012
    depth = 0.010
    outline = (
        (-half_width, center_z + lift),
        (-half_width * 0.30, center_z),
        (half_width * 0.30, center_z),
        (half_width, center_z + lift),
        (half_width, center_z + lift + band),
        (half_width * 0.30, center_z + band),
        (-half_width * 0.30, center_z + band),
        (-half_width, center_z + lift + band),
    )
    vertices = [(x, front_y - depth / 2, z) for x, z in outline]
    vertices.extend((x, front_y + depth / 2, z) for x, z in outline)
    count = len(outline)
    faces = [tuple(range(count)), tuple(range(count * 2 - 1, count - 1, -1))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    return _mesh_object("Face_Mouth", vertices, faces, material)


def _tee_shirt(dna, material) -> bpy.types.Object:
    vertices = []
    faces = []
    bottom_z = dna.waist_z + dna.head_height * 0.035
    top_z = dna.neck_z + dna.head_height * 0.015
    height = top_z - bottom_z
    torso_center_z = (top_z + bottom_z) / 2
    torso_width = dna.torso_width * 1.06
    torso_depth = dna.torso_depth * 1.08
    _append_box(vertices, faces, (0, 0, torso_center_z), (torso_width, torso_depth, height))
    sleeve_z = top_z - dna.head_height * 0.105
    sleeve_width = dna.head_height * 0.18
    for sign in (-1.0, 1.0):
        _append_box(
            vertices,
            faces,
            (sign * (torso_width / 2 + sleeve_width * 0.40), 0, sleeve_z),
            (sleeve_width, torso_depth * 0.96, dna.head_height * 0.19),
        )
    obj = _mesh_object("Clothing_AFrameShirt", vertices, faces, material)
    obj["clothingSilhouette"] = "tee/v1"
    return obj


def _shorts(dna, material) -> bpy.types.Object:
    vertices = []
    faces = []
    waist_height = dna.head_height * 0.065
    leg_height = dna.head_height * 0.15
    waist_center_z = dna.waist_z - waist_height * 0.20
    _append_box(
        vertices,
        faces,
        (0, 0, waist_center_z),
        (dna.hip_width * 1.16, dna.torso_depth * 1.12, waist_height),
    )
    leg_center_z = dna.waist_z - waist_height * 0.42 - leg_height * 0.54
    for sign in (-1.0, 1.0):
        _append_box(
            vertices,
            faces,
            (sign * dna.hip_width * 0.235, 0, leg_center_z),
            (dna.hip_width * 0.50, dna.torso_depth * 1.10, leg_height),
        )
    obj = _mesh_object("Clothing_Boxers", vertices, faces, material)
    obj["clothingSilhouette"] = "shorts/v1"
    return obj


def _replace_object(name: str, builder, root: bpy.types.Object) -> bpy.types.Object:
    existing = bpy.data.objects.get(name)
    if existing is None or existing.type != "MESH":
        raise ValueError(f"Generated Chibi is missing reusable style part {name}")
    material = _material_from(existing)
    _remove(existing)
    replacement = builder(material)
    replacement.parent = root
    return replacement


def apply_style_part_variants(root: bpy.types.Object, dna, document: dict) -> dict:
    """Resolve exact style selections to concrete meshes while preserving rig names."""
    validated = validate_style_configuration(document)
    selections = validated["selections"]
    source_parts = resolved_source_parts(validated)

    if selections["head-shape"] != "soft-round":
        replacement = _replace_object(
            "Body_Head",
            lambda material: _head_mesh(dna, selections["head-shape"], material),
            root,
        )
        _tag(replacement, "head-shape", selections["head-shape"], source_parts["head-shape"])

    if selections["eyes"] != "vertical-oval":
        for name, sign in (("Face_LeftEye", -1.0), ("Face_RightEye", 1.0)):
            replacement = _replace_object(
                name,
                lambda material, name=name, sign=sign: _eye(
                    name,
                    sign * dna.eye_spacing / 2,
                    dna,
                    selections["eyes"],
                    material,
                ),
                root,
            )
            _tag(replacement, "eyes", selections["eyes"], source_parts["eyes"])

    if selections["mouth"] == "soft-smile":
        replacement = _replace_object(
            "Face_Mouth",
            lambda material: _soft_smile(dna, material),
            root,
        )
        _tag(replacement, "mouth", selections["mouth"], source_parts["mouth"])

    if selections["hair"] == "side-swept":
        replacement = _replace_object(
            "Hair_Cap",
            lambda material: _side_swept_hair(dna, material),
            root,
        )
        _tag(replacement, "hair", selections["hair"], source_parts["hair"])

    if selections["torso-clothing"] == "tee-shorts":
        shirt = _replace_object(
            "Clothing_AFrameShirt",
            lambda material: _tee_shirt(dna, material),
            root,
        )
        shorts = _replace_object(
            "Clothing_Boxers",
            lambda material: _shorts(dna, material),
            root,
        )
        _tag(shirt, "torso-clothing", selections["torso-clothing"], source_parts["torso-clothing"])
        _tag(shorts, "torso-clothing", selections["torso-clothing"], source_parts["torso-clothing"])

    tag_targets = {
        "body-shape": ("Body_Core",),
        "head-shape": ("Body_Head",),
        "eyes": ("Face_LeftEye", "Face_RightEye"),
        "nose": ("Face_Nose",),
        "mouth": ("Face_Mouth",),
        "ears": ("Body_LeftEar", "Body_RightEar"),
        "hair": ("Hair_Cap",),
        "torso-clothing": ("Clothing_AFrameShirt", "Clothing_Boxers"),
        "feet": ("Body_LeftFoot", "Body_RightFoot"),
    }
    for slot_id, names in tag_targets.items():
        for name in names:
            obj = bpy.data.objects.get(name)
            if obj is None:
                raise ValueError(f"Style slot {slot_id!r} resolved to missing mesh {name!r}")
            _tag(obj, slot_id, selections[slot_id], source_parts[slot_id])

    root["partLibrarySchema"] = PART_LIBRARY_SCHEMA
    root["styleKitId"] = validated["styleKitId"]
    root["styleKitVersion"] = validated["styleKitVersion"]
    return {
        "schema": PART_LIBRARY_SCHEMA,
        "selections": dict(selections),
        "resolvedSourceParts": source_parts,
    }
